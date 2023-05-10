import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
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
        BackInStockPlugin,
        AssetServerPlugin.init({
          assetUploadDir: path.join(__dirname, '../__data__/assets'),
          route: 'assets',
        }),
        DefaultSearchPlugin,
        AdminUiPlugin.init({
          port: 3002,
          route: 'admin',
        //   app: compileUiExtensions({
        //     outputPath: path.join(__dirname, '__admin-ui'),
        //     extensions: [BackInStockPlugin.uiExtensions],
        //     devMode: true,
        //   }),
        }),
      ],
    });
    const { server, shopClient, adminClient } = createTestEnvironment(config);
    await server.init({
      initialData,
      productsCsvPath: './test/products.csv',
    });
})();