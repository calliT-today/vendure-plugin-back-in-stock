import { Injectable } from '@nestjs/common';
import { PaginatedList } from '@vendure/common/lib/shared-types';
import {
    ListQueryBuilder,
    RequestContext,
    ListQueryOptions,
    RelationPaths,
    Channel,
    ChannelService,
    Customer,
    CustomerService,
    ProductVariant,
    ProductVariantService,
    ID,
    TransactionalConnection,
    patchEntity,
    ErrorResultUnion,
    InternalServerError,
    EventBus,
    TranslatorService,
    StockMovementEvent,
    StockLevelService,
    Logger,
} from '@vendure/core';
import { BackInStock } from '../entity/back-in-stock.entity';
import { BackInStockSubscriptionStatus } from '../types';
import {
    CreateBackInStockInput,
    CreateBackInStockSubscriptionResult,
    ErrorCode,
    SortOrder,
    UpdateBackInStockInput,
} from '../ui/generated/graphql-shop-api-types';
import { BackInStockOptions } from '../back-in-stock.plugin';
import { BackInStockEvent } from '../events/back-in-stock.event';
import { OnApplicationBootstrap, Inject } from '@nestjs/common';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';

/**
 * @description
 * Contains methods relating to {@link BackInStock} entities.
 *
 */
@Injectable()
export class BackInStockService implements OnApplicationBootstrap {
    private readonly relations = ['productVariant', 'channel', 'customer'];

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private channelService: ChannelService,
        private customerService: CustomerService,
        private productVariantService: ProductVariantService,
        private translatorService: TranslatorService,
        private eventBus: EventBus,
        private stockLevelService: StockLevelService,
        @Inject(PLUGIN_INIT_OPTIONS) private options: BackInStockOptions
    ) { }


    onApplicationBootstrap() {
        // Listen for stock movements and update subscriptions
        this.eventBus.ofType(StockMovementEvent).subscribe(async event => {
            // Check new stockLevel of each variant in the event
            Promise.all(event.stockMovements.map(async ({ productVariant }) => {
                const stock = await this.stockLevelService.getAvailableStock(event.ctx, productVariant.id);
                const saleableStock =
                    stock.stockOnHand -
                    stock!.stockAllocated -
                    productVariant!.outOfStockThreshold;
                if (saleableStock < 1) {
                    return; // Still not in stock
                }
                const backInStockSubscriptions = await this.findActiveForProductVariant(
                    event.ctx,
                    productVariant!.id,
                    {
                        take: this.options.limitEmailToStock ? saleableStock : 9999999,
                        sort: {
                            createdAt: SortOrder.Asc,
                        },
                    },
                );
                if (backInStockSubscriptions.totalItems < 1) {
                    return; // No subscriptions to notify
                }
                await Promise.all(backInStockSubscriptions.items.map(async subscription =>
                    this.update(event.ctx, {
                        id: subscription.id,
                        status: BackInStockSubscriptionStatus.Notified,
                    })));
            }));
        });
    }

    async findOne(ctx: RequestContext, id: ID): Promise<BackInStock | null> {
        return this.connection.getRepository(ctx, BackInStock).findOne({
            where: {
                id
            },
            relations: { productVariant: true, channel: true, customer: true },
        });
    }

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<BackInStock>,
        relations?: RelationPaths<ProductVariant> | RelationPaths<Channel> | RelationPaths<Customer>,
    ): Promise<PaginatedList<BackInStock>> {
        return this.listQueryBuilder
            .build(BackInStock, options, {
                relations: relations || this.relations,
                ctx,
            })
            .getManyAndCount()
            .then(async ([items, totalItems]) => {
                return {
                    items,
                    totalItems,
                };
            });
    }

    async findActiveForProductVariant(
        ctx: RequestContext,
        productVariantId: ID,
        options?: ListQueryOptions<BackInStock>,
        relations?: RelationPaths<Channel> | RelationPaths<Customer>,
    ): Promise<PaginatedList<BackInStock>> {
        const productVariant = await this.productVariantService.findOne(ctx, productVariantId);

        return this.listQueryBuilder
            .build(BackInStock, options, {
                relations: relations || this.relations,
                ctx,
                where: {
                    productVariant: { id: productVariantId },
                    status: BackInStockSubscriptionStatus.Created,
                },
            })
            .getManyAndCount()
            .then(async ([items, totalItems]) => {
                return {
                    items,
                    totalItems,
                };
            });
    }

    async findActiveForProductVariantWithCustomer(
        ctx: RequestContext,
        productVariantId: ID,
        email: string,
    ): Promise<BackInStock | null> {
        const { channelId } = ctx;
        const status = BackInStockSubscriptionStatus.Created;
        const queryBuilder = this.connection
            .getRepository(ctx, BackInStock)
            .createQueryBuilder('backInStock')
            .leftJoinAndSelect('backInStock.channel', 'channel')
            .leftJoinAndSelect('backInStock.productVariant', 'productVariant')
            .where(
                'productVariant.id = :productVariantId AND backInStock.email = :email AND backInStock.status = :status AND backInStock.channelId = :channelId',
                {
                    productVariantId,
                    email,
                    status,
                    channelId,
                },
            );
        return await queryBuilder.getOne();
    }

    async create(
        ctx: RequestContext,
        input: CreateBackInStockInput,
    ): Promise<ErrorResultUnion<CreateBackInStockSubscriptionResult, BackInStock>> {
        const { email, productVariantId } = input;
        const channel = await this.channelService.getChannelFromToken(ctx.channel.token);
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId as ID);
        const productVariant = await this.productVariantService.findOne(ctx, productVariantId);

        if (!email && !customer) {
            return {
                errorCode: ErrorCode.UnknownError,
                message: 'Email is required!',
            };
        }

        const existingSubscription = await this.findActiveForProductVariantWithCustomer(
            ctx,
            productVariantId,
            email,
        );

        if (!existingSubscription) {
            const backInStockSubscription = new BackInStock({
                email: email || customer?.emailAddress,
                productVariant,
                channel,
                customer,
                status: BackInStockSubscriptionStatus.Created,
            });
            return await this.connection.getRepository(ctx, BackInStock).save(backInStockSubscription);
        } else {
            return {
                errorCode: ErrorCode.BackInStockAlreadySubscribedError,
                message: 'Already subscribed!',
            };
        }
    }

    // publishes the event that fires off the email notification when subscription is updated as notified
    async update(ctx: RequestContext, input: UpdateBackInStockInput): Promise<BackInStock> {
        const subscription = await this.findOne(ctx, input.id);
        if (!subscription) {
            throw new InternalServerError('Subscription not found');
        }

        const updatedSubscription = patchEntity(subscription, input);
        if (input.status === 'Notified') {
            if (this.options.enableEmail) {
                const translatedVariant = this.translatorService.translate(subscription.productVariant, ctx);
                this.eventBus.publish(
                    new BackInStockEvent(ctx, subscription, translatedVariant, 'updated', subscription.email),
                );
                Logger.info(`Publish "BackInStockEvent" for variant ${translatedVariant.sku} to notify "${subscription.email}"`, loggerCtx);
            } else {
                throw new InternalServerError('Email notification disabled');
            }
        }
        return this.connection.getRepository(ctx, BackInStock).save(updatedSubscription);
    }
}
