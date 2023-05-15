import {
  DefaultLogger,
  EventBus,
  LogLevel,
  RequestContext,
  StockLocationService,
  StockMovementService
} from '@vendure/core';
import {
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
  testConfig,
} from '@vendure/testing';
import { BackInStockPlugin } from '../src';
import { BackInStockEvent } from '../src/events/back-in-stock.event';
import { BackInStock } from '../src/ui/generated/graphql-shop-api-types';
import { createBackInStockSubscription, getActiveOrder, updateVariants } from './helpers';
import { initialData } from './initial-data';

jest.setTimeout(10000);

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
  const publishedEvents: any[] = [];
  const TEST_EMAIL_ADDRESS = 'martijn@pinelab.studio';

  beforeAll(async () => {
    await server.init({
      initialData,
      productsCsvPath: './test/products.csv',
    });
    started = true;
    server.app.get(EventBus).ofType(BackInStockEvent).subscribe(event => publishedEvents.push(event));
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
    await adminClient.asSuperAdmin();
    
    // First set variant T_1 stock to 0;
    const result = await server.app.get(StockMovementService).adjustProductVariantStock(
      RequestContext.empty(),
      'T_1',
      999
    );
    expect(result[0].quantity).toBe(999);
    expect(publishedEvents.length).toBe(1);
    expect(publishedEvents[0].emailAddress).toBe(TEST_EMAIL_ADDRESS);
    expect(publishedEvents[0].productVariant.id).toBe(1);
  });

});
