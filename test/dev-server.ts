import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import {
  ChannelService,
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  RequestContext,
  StockMovementService,
  mergeConfig,
} from '@vendure/core';
import {
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
} from '@vendure/testing';
import path from 'path';
import { initialData } from './initial-data';
import {BackInStockPlugin} from '../src';
import { compileUiExtensions } from '@vendure/ui-devkit/compiler';

(async () => {
    require('dotenv').config();
    const { testConfig } = require('@vendure/testing');
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      apiOptions: {
        adminApiPlayground: {},
        shopApiPlayground: {},
      },
      plugins: [
        BackInStockPlugin.init({
          enableEmail: true,
          limitEmailToStock: true,
          allowSubscriptionWithoutSession: true
        }),
        AssetServerPlugin.init({
          assetUploadDir: path.join(__dirname, '../__data__/assets'),
          route: 'assets',
        }),
        DefaultSearchPlugin,
        AdminUiPlugin.init({
          port: 3002,
          route: 'admin',
          // app: compileUiExtensions({
          //   outputPath: path.join(__dirname, '__admin-ui'),
          //   extensions: [BackInStockPlugin.uiExtensions],
          //   devMode: true,
          // }),
        }),
      ],
    });
    const { server, shopClient, adminClient } = createTestEnvironment(config);
    await server.init({
      initialData,
      productsCsvPath: './test/products.csv',
    });
    // Publish a StockMovementEvent to trigger the BackInStockEvent
    const ctx = new RequestContext({
      apiType: 'admin',
      authorizedAsOwnerOnly: false,
      channel: await server.app.get(ChannelService).getDefaultChannel(),
      isAuthorized: true,
    })
    await new Promise(resolve => setTimeout(resolve, 1000));
    await server.app.get(StockMovementService).adjustProductVariantStock(
      ctx,
      1,
      999
    );
})();