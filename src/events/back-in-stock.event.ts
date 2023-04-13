import { ProductVariant, RequestContext, VendureEvent } from '@vendure/core';
import { BackInStock } from '../entity/back-in-stock.entity';

/**
 * @description
 * This event is fired when a {@link BackInStock} is added, updated
 * or deleted.
 *
 * @docsCategory events
 * @docsPage Event Types
 */
export class BackInStockEvent extends VendureEvent {
    constructor(
        public ctx: RequestContext,
        public entity: BackInStock,
        public productVariant: ProductVariant,
        public type: 'created' | 'updated' | 'deleted',
        public emailAddress: string,
    ) {
        super();
    }
}
