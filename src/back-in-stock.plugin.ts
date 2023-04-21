import {
    EntityHydrator,
    PluginCommonModule,
    ProductVariant,
    ProductVariantService,
    RequestContextService,
    TransactionalConnection,
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
 * Subscribes to {@link ProductVariant} inventory changes
 * and FIFO updates BackInStock {@link BackInStock} to be notified
 * to the amount of saleable stock with plugin init option
 * limitEmailToStock = true or false to notify all subscribers
 *
 */
@Injectable()
@EventSubscriber()
export class ProductVariantSubscriber implements EntitySubscriberInterface<ProductVariant> {
    constructor(
        private connection: TransactionalConnection,
        private backInStockService: BackInStockService,
        private productVariantService: ProductVariantService,
        private requestContextService: RequestContextService,
    ) {
        this.connection.rawConnection.subscribers.push(this);
    }
    listenTo() {
        return ProductVariant;
    }

    // set subscriptions to be notified only on replenishment event
    async afterUpdate(event: UpdateEvent<ProductVariant>) {
        if (
            event.entity?.stockOnHand > event.databaseEntity?.stockOnHand &&
            BackInStockPlugin.options.enableEmail
        ) {
            const ctx = await this.requestContextService.create({ apiType: getApiType() });
            const productVariant = await this.productVariantService.findOne(ctx, event.entity?.id);
            //! calculate saleable manually as this context is not aware of the current db transaction
            const saleableStock =
                event.entity?.stockOnHand -
                productVariant!.stockAllocated -
                productVariant!.outOfStockThreshold;

            const backInStockSubscriptions = await this.backInStockService.findActiveForProductVariant(
                ctx,
                productVariant!.id,
                {
                    take: BackInStockPlugin.options.limitEmailToStock ? saleableStock : undefined,
                    sort: {
                        createdAt: SortOrder.ASC,
                    },
                },
            );

            if (saleableStock >= 1 && backInStockSubscriptions.totalItems >= 1) {
                for (const subscription of backInStockSubscriptions.items) {
                    this.backInStockService.update(ctx, {
                        id: subscription.id,
                        status: BackInStockSubscriptionStatus.Notified,
                    });
                }
            }
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
        ProductVariantSubscriber,
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
    static options: BackInStockOptions = {
        enableEmail: true,
        limitEmailToStock: true,
    };

    static init(options: BackInStockOptions): typeof BackInStockPlugin {
        this.options = options;
        return BackInStockPlugin;
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
