import {
    EntityHydrator,
    PluginCommonModule,
    VendurePlugin
} from '@vendure/core';
import { EmailEventListener } from '@vendure/email-plugin';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { BackInStockAdminResolver } from './api/back-in-stock-admin.resolver';
import { BackInStockResolver } from './api/back-in-stock.resolver';
import { UnionResolver } from './api/union.resolver';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { BackInStock } from './entity/back-in-stock.entity';
import { BackInStockEvent } from './events/back-in-stock.event';
import { BackInStockService } from './service/back-in-stock.service';

export interface BackInStockOptions {
    enableEmail: boolean;
    /**
     * Only sent amount of emails equal to the saleable stock. 
     * E.g. Only sent an email to 5 subscribers when 
     * the saleable stock has been updated to 5
     */
    limitEmailToStock: boolean;
    /**
     * Allow subscribing to out of stock emails for calls without a session. Defaults to true.
     * With allowSubscriptionWithoutSession=true anyone can subscribe to out of stock emails, 
     * even when the caller doesn't have an active session
     */
    allowSubscriptionWithoutSession?: boolean;
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
    static options: BackInStockOptions = {
        enableEmail: true,
        limitEmailToStock: true,
        allowSubscriptionWithoutSession: true,
    };

    static init(options: BackInStockOptions): typeof BackInStockPlugin {
        this.options = {
            ...this.options,
            ...options
        }; // Only override whats passed in, leave the other defaults
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
