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
    EntityHydrator,
    ConfigService,
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
        private configService: ConfigService,
        @Inject(PLUGIN_INIT_OPTIONS) private options: BackInStockOptions
    ) { }


    onApplicationBootstrap() {
        // Listen for stock movements and update subscriptions
        this.eventBus.ofType(StockMovementEvent).subscribe(async event => {
            this.handleStockMovement(event).catch((e: unknown) => Logger.error(`Failed to handle StockMovementEvent ${e}`, loggerCtx));
        });
    }

    async handleStockMovement(event: StockMovementEvent): Promise<void> {
        // Refetch variants, because variants in event does not have all properties fetched from DB
        const variants = await this.productVariantService.findByIds(event.ctx, event.stockMovements.map(sm => sm.productVariant.id));
        // Check new stockLevel of each variant in the event
        await Promise.all(variants.map(async (productVariant) => {
            const saleableStock = await this.productVariantService.getSaleableStockLevel(event.ctx, productVariant);
            if (isNaN(saleableStock)) {
                // This can happen when an event is fired during bootstrap, 
                // so Vendure can't yet resolve saleable stock for some reason
                throw Error(`Saleable stock returned NaN for variant ${productVariant.id}`);
            }
            if (saleableStock < 1) {
                return; // Still not in stock
            }
            let takeLimit = this.options.limitEmailToStock ? saleableStock : undefined;
            if (takeLimit && takeLimit > this.configService.apiOptions.adminListQueryLimit) {
                takeLimit = this.configService.apiOptions.adminListQueryLimit;
            }
            const backInStockSubscriptions = await this.findActiveForProductVariant(
                event.ctx,
                productVariant!.id,
                {
                    take: this.options.limitEmailToStock ? saleableStock : undefined,
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

        if (!productVariant) {
            return {
                errorCode: ErrorCode.UnknownError,
                message: `No variant found with ID ${input.productVariantId}`,
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
