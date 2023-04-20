import { ProductVariant, RequestContext, VendureEvent } from '@vendure/core';
import { BackInStock } from '../entity/back-in-stock.entity';

/**
 * @description
 * This event for a {@link BackInStock} subscription is listened to
 * by the email handler for firing off email notifications.
 *
 */
export class BackInStockEvent extends VendureEvent {
    constructor(
        public ctx: RequestContext,
        public entity: BackInStock,
        public productVariant: ProductVariant,
        public type: 'updated',
        public emailAddress: string,
    ) {
        super();
    }
}
