import { Args, Resolver, Query, Mutation } from '@nestjs/graphql';
import { RequestContext, Ctx, ErrorResultUnion } from '@vendure/core';
import { BackInStock } from '../entity/back-in-stock.entity';
import { BackInStockService } from '../service/back-in-stock.service';
import {
    MutationCreateBackInStockSubscriptionArgs,
    QueryActiveBackInStockSubscriptionForProductVariantWithCustomerArgs,
    CreateBackInStockSubscriptionResult,
} from '../../generated/generated-shop-types';

@Resolver()
export class BackInStockResolver {
    constructor(private backInStockService: BackInStockService) {}

    @Query()
    async activeBackInStockSubscriptionForProductVariantWithCustomer(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryActiveBackInStockSubscriptionForProductVariantWithCustomerArgs,
    ): Promise<BackInStock | undefined> {
        return this.backInStockService.findActiveForProductVariantWithCustomer(
            ctx,
            args.input.productVariantId,
            args.input.email,
        );
    }

    @Mutation()
    async createBackInStockSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationCreateBackInStockSubscriptionArgs,
    ): Promise<ErrorResultUnion<CreateBackInStockSubscriptionResult, BackInStock>> {
        return this.backInStockService.create(ctx, args.input);
    }
}
