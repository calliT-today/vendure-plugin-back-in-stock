import {
    EntityHydrator,
    EventBus,
    InternalServerError,
    PluginCommonModule,
    ProductVariantEvent,
    ProductVariantService,
    RequestContextService,
    TransactionalConnection,
    TranslatorService,
    VendurePlugin,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { BackInStockResolver } from './api/back-in-stock.resolver';
import { BackInStock } from './entity/back-in-stock.entity';
import { BackInStockService } from './service/back-in-stock.service';
import { EmailEventListener } from '@vendure/email-plugin';
import { BackInStockEvent } from './events/back-in-stock.event';
import { SortOrder } from '../generated/generated-shop-types';
import { BackInStockSubscriptionStatus } from './types';
import { UnionResolver } from './api/union.resolver';
import { BackInStockAdminResolver } from './api/back-in-stock-admin.resolver';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { getApiType } from '@vendure/core/dist/api/common/get-api-type';

export interface BackInStockOptions {
    enableEmail: boolean;
    limitEmailToStock: boolean;
}

/**
 * @description
 * Subscribes to {@link BackInStock} subscription changes
 * and publishes the event that fires the email notification
 * when subscription is updated as notified.
 *
 */
@Injectable()
@EventSubscriber()
export class BackInStockSubscriber implements EntitySubscriberInterface<BackInStock> {
    constructor(
        private connection: TransactionalConnection,
        private eventBus: EventBus,
        private backInStockService: BackInStockService,
        private requestContextService: RequestContextService,
        private translatorService: TranslatorService,
    ) {
        this.connection.rawConnection.subscribers.push(this);
    }
    listenTo() {
        return BackInStock;
    }

    // cancel update as 'Notified' when email sending is disabled
    async beforeUpdate(event: UpdateEvent<BackInStock>) {
        if (event.entity?.status === 'Notified' && !BackInStockPlugin.options.enableEmail) {
            throw new InternalServerError('Email notification disabled');
        }
    }

    // create event for sending email notifications
    async afterUpdate(event: UpdateEvent<BackInStock>) {
        if (event.entity?.status === 'Notified' && BackInStockPlugin.options.enableEmail) {
            const ctx = await this.requestContextService.create({ apiType: getApiType() });
            const subscription = await this.backInStockService.findOne(ctx, event.entity?.id);
            const translatedVariant = this.translatorService.translate(subscription!.productVariant, ctx);
            this.eventBus.publish(
                new BackInStockEvent(ctx, subscription!, translatedVariant, 'updated', subscription!.email),
            );
        }
    }
}

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [BackInStock],
    providers: [
        {
            provide: PLUGIN_INIT_OPTIONS,
            useFactory: () => BackInStockPlugin.options,
        },
        BackInStockService,
        BackInStockSubscriber,
    ],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [BackInStockResolver, UnionResolver],
    },
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [BackInStockResolver, BackInStockAdminResolver, UnionResolver],
    },
})
export class BackInStockPlugin {
    constructor(
        private eventBus: EventBus,
        private backInStockService: BackInStockService,
        private productVariantService: ProductVariantService,
    ) {}
    static options: BackInStockOptions = {
        enableEmail: true,
        limitEmailToStock: true,
    };
    static init(options: BackInStockOptions): typeof BackInStockPlugin {
        this.options = options;
        return BackInStockPlugin;
    }

    /**
     * @description
     * Subscribes to {@link ProductVariantEvent} inventory changes
     * and FIFO updates BackInStock {@link BackInStock} to be notified
     * to the amount of saleable stock with plugin init option
     * limitEmailToStock = true or false to notify all subscribers
     *
     */
    async onApplicationBootstrap() {
        if (BackInStockPlugin.options.enableEmail) {
            this.eventBus.ofType(ProductVariantEvent).subscribe(async event => {
                for (const productVariant of event.entity) {
                    const saleableStock = await this.productVariantService.getSaleableStockLevel(
                        event.ctx,
                        productVariant,
                    );
                    const backInStockSubscriptions =
                        await this.backInStockService.findActiveForProductVariant(
                            event.ctx,
                            productVariant.id,
                            {
                                take: BackInStockPlugin.options.limitEmailToStock ? saleableStock : undefined,
                                sort: {
                                    createdAt: SortOrder.ASC,
                                },
                            },
                        );
                    if (saleableStock >= 1 && backInStockSubscriptions.totalItems >= 1) {
                        for (const subscription of backInStockSubscriptions.items) {
                            this.backInStockService.update(event.ctx, {
                                id: subscription.id,
                                status: BackInStockSubscriptionStatus.Notified,
                            });
                        }
                    }
                }
            });
        }
    }

    static uiExtensions: AdminUiExtension = {
        extensionPath: path.join(__dirname, 'ui'),
        ngModules: [
            {
                type: 'shared' as const,
                ngModuleFileName: 'back-in-stock-shared.module.ts',
                ngModuleName: 'BackInStockSharedModule',
            },
            {
                type: 'lazy' as const,
                route: 'back-in-stock',
                ngModuleFileName: 'back-in-stock.module.ts',
                ngModuleName: 'BackInStockModule',
            },
        ],
    };
}

export const backInStockNotificationHandler = new EmailEventListener('back-in-stock')
    .on(BackInStockEvent)
    .setRecipient(event => event?.emailAddress)
    .setFrom(`{{ fromAddress }}`)
    .setSubject(`{{ productVariant.name }} - Back in Stock!`)
    .loadData(async ({ event, injector }) => {
        const hydrator = injector.get(EntityHydrator);
        await hydrator.hydrate(event.ctx, event.productVariant, {
            relations: ['product'],
        });
        return { productVariant: event.productVariant };
    })
    .setTemplateVars(event => ({
        productVariant: event.productVariant,
        url: 'http://localhost:8080/products',
    }));
