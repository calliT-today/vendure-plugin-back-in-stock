import {
  ChannelService,
  DefaultLogger,
  EventBus,
  LogLevel,
  RequestContext,
  StockMovementService
} from '@vendure/core';
import {
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
  testConfig,
} from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BackInStockPlugin } from '../src';
import { BackInStockEvent } from '../src/events/back-in-stock.event';
import { BackInStock } from '../src/ui/generated/graphql-shop-api-types';
import { createBackInStockSubscription, getActiveOrder } from './helpers';
import { initialData } from './initial-data';

describe('Back in Stock notifier', () => {

  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  testConfig.plugins.push(
    BackInStockPlugin.init({
      enableEmail: true,
      limitEmailToStock: false,
      allowSubscriptionWithoutSession: false
    }),
  );
  // Enable this line to see debug logs
  testConfig.logger = new DefaultLogger({ level: LogLevel.Debug });
  const { server, adminClient, shopClient } = createTestEnvironment(testConfig);
  let started = false;
  const TEST_EMAIL_ADDRESS = 'martijn@pinelab.studio';

  beforeAll(async () => {
    await server.init({
      initialData,
      productsCsvPath: './test/products.csv',
    });
    started = true;
  }, 60000);

  afterAll(async () => {
    await server.destroy();
  });

  it('Should start successfully', async () => {
    expect(started).toBe(true);
  });

  it('Should not allow session-less subscriptions', async () => {
    await shopClient.asAnonymousUser();
    let error: any = undefined;
    try {
      await createBackInStockSubscription(shopClient, TEST_EMAIL_ADDRESS, 'T_1');
    } catch (e) {
      error = e;
    }
    expect(error?.message).toBe('You are not currently authorized to perform this action');
  });

  it('Should subscribe to stock notifications with a session', async () => {
    await getActiveOrder(shopClient); // This creates a session
    const result = await createBackInStockSubscription(shopClient, TEST_EMAIL_ADDRESS, 'T_1');
    expect((result as BackInStock).email).toBe(TEST_EMAIL_ADDRESS);
    expect((result as BackInStock).productVariant.id).toBe('T_1');
  });

  it('Should publish event when variant is back in stock', async () => {
    const publishedEvents: any[] = [];
    server.app.get(EventBus).ofType(BackInStockEvent).subscribe(event => publishedEvents.push(event));
    await adminClient.asSuperAdmin();
    // Update stock
    const ctx = new RequestContext({
      apiType: 'admin',
      authorizedAsOwnerOnly: false,
      channel: await server.app.get(ChannelService).getDefaultChannel(),
      isAuthorized: true,
    })
    await server.app.get(StockMovementService).adjustProductVariantStock(
      ctx,
      1,
      999
    );
    await new Promise(resolve => setTimeout(resolve, 3000)); // Await async job processing
    expect(publishedEvents.length).toBe(1);
    expect(publishedEvents[0].emailAddress).toBe(TEST_EMAIL_ADDRESS);
    expect(publishedEvents[0].productVariant.id).toBe(1);
  });

});
