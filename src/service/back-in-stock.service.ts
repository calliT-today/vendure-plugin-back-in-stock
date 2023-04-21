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
} from '@vendure/core';
import { BackInStock } from '../entity/back-in-stock.entity';
import { BackInStockSubscriptionStatus } from '../types';
import {
    CreateBackInStockInput,
    CreateBackInStockSubscriptionResult,
    ErrorCode,
    UpdateBackInStockInput,
} from '../../generated/generated-shop-types';
import { BackInStockPlugin } from '../back-in-stock.plugin';
import { BackInStockEvent } from '../events/back-in-stock.event';

/**
 * @description
 * Contains methods relating to {@link BackInStock} entities.
 *
 */
@Injectable()
export class BackInStockService {
    private readonly relations = ['productVariant', 'channel', 'customer'];

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private channelService: ChannelService,
        private customerService: CustomerService,
        private productVariantService: ProductVariantService,
        private translatorService: TranslatorService,
        private eventBus: EventBus,
    ) {}

    async findOne(ctx: RequestContext, id: ID): Promise<BackInStock | undefined> {
        return this.connection.getRepository(ctx, BackInStock).findOne(id, {
            relations: this.relations,
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
                    productVariant,
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
    ): Promise<BackInStock | undefined> {
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
                errorCode: ErrorCode.UNKNOWN_ERROR,
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
                errorCode: ErrorCode.BACK_IN_STOCK_ALREADY_SUBSCRIBED_ERROR,
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
            if (BackInStockPlugin.options.enableEmail) {
                const translatedVariant = this.translatorService.translate(subscription.productVariant, ctx);
                this.eventBus.publish(
                    new BackInStockEvent(ctx, subscription, translatedVariant, 'updated', subscription.email),
                );
            } else {
                throw new InternalServerError('Email notification disabled');
            }
        }
        return this.connection.getRepository(ctx, BackInStock).save(updatedSubscription);
    }
}
