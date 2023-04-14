import {
    EntityHydrator,
    EventBus,
    PluginCommonModule,
    ProductVariantEvent,
    ProductVariantService,
    VendurePlugin,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { BackInStockResolver } from './api/back-in-stock.resolver';
import { BackInStock } from './entity/back-in-stock.entity';
import { BackInStockService } from './service/back-in-stock.service';
import { EmailEventListener } from '@vendure/email-plugin';
import { BackInStockEvent } from './events/back-in-stock.event';
import { BackInStockSubscriptionStatus, SortOrder } from '../generated/generated-shop-types';
import { UnionResolver } from './api/union.resolver';
import { BackInStockAdminResolver } from './api/back-in-stock-admin.resolver';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';

export interface BackInStockOptions {
    enabled: boolean;
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
    static options: BackInStockOptions;

    static init(options: BackInStockOptions) {
        this.options = options;
        return BackInStockPlugin;
    }

    /**
     * @description
     * Subscribes to {@link ProductVariantEvent} inventory changes
     * and sends FIFO BackInStock {@link BackInStock} notifications.
     *
     */
    async onApplicationBootstrap() {
        this.eventBus.ofType(ProductVariantEvent).subscribe(async event => {
            for (const productVariant of event.entity) {
                const saleableStock = await this.productVariantService.getSaleableStockLevel(
                    event.ctx,
                    productVariant,
                );
                const backInStockSubscriptions = await this.backInStockService.findActiveForProductVariant(
                    event.ctx,
                    productVariant.id,
                    {
                        sort: {
                            createdAt: SortOrder.ASC,
                        },
                    },
                );
                if (saleableStock >= 1 && backInStockSubscriptions.totalItems >= 1) {
                    for (const subscription of backInStockSubscriptions.items) {
                        this.eventBus.publish(
                            new BackInStockEvent(
                                event.ctx,
                                subscription,
                                productVariant,
                                'updated',
                                subscription.email,
                            ),
                        );
                        // TODO: verify email is sent successfully before update
                        this.backInStockService.update(event.ctx, {
                            id: subscription.id,
                            status: BackInStockSubscriptionStatus.Notified,
                        });
                    }
                }
            }
        });
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
