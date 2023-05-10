import { DeepPartial } from '@vendure/common/lib/shared-types';
import { Channel, Customer, ProductVariant, VendureEntity } from '@vendure/core';
import { Column, Entity, ManyToOne } from 'typeorm';
import { BackInStockSubscriptionStatus } from '../types';

/**
 * @description
 * A back-in-stock notification is subscribed to by a {@link Customer}
 * or by a guest user with email address.
 */
@Entity()
export class BackInStock extends VendureEntity {
    constructor(input?: DeepPartial<BackInStock>) {
        super(input);
    }

    @Column('varchar')
    status!: BackInStockSubscriptionStatus;

    @ManyToOne(type => ProductVariant, { nullable: false })
    productVariant!: ProductVariant;

    @ManyToOne(type => Channel, { nullable: false })
    channel!: Channel;

    @ManyToOne(type => Customer, { nullable: true })
    customer?: Customer;

    @Column('varchar', { nullable: false })
    email!: string;
}
