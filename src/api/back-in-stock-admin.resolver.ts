import { Args, Resolver, Query, Mutation } from '@nestjs/graphql';
import { RequestContext, Ctx, PaginatedList, ID } from '@vendure/core';
import { BackInStock } from '../entity/back-in-stock.entity';
import { BackInStockService } from '../service/back-in-stock.service';
import {
    MutationUpdateBackInStockSubscriptionArgs,
    QueryActiveBackInStockSubscriptionsForProductVariantArgs,
    QueryBackInStockSubscriptionArgs,
} from '../generated/graphql-admin-api-types';
@Resolver()
export class BackInStockAdminResolver {
    constructor(private backInStockService: BackInStockService) {}

    @Query()
    async activeBackInStockSubscriptionsForProductVariant(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryActiveBackInStockSubscriptionsForProductVariantArgs,
    ): Promise<PaginatedList<BackInStock>> {
        return this.backInStockService.findActiveForProductVariant(ctx, args.input?.productVariantId as ID);
    }

    @Query()
    async backInStockSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryBackInStockSubscriptionArgs,
    ) {
        return this.backInStockService.findOne(ctx, args.id);
    }

    @Query()
    async backInStockSubscriptions(
        @Ctx() ctx: RequestContext,
        @Args() args: any,
    ): Promise<PaginatedList<BackInStock>> {
        return this.backInStockService.findAll(ctx, args.options);
    }

    @Mutation()
    async updateBackInStockSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationUpdateBackInStockSubscriptionArgs,
    ): Promise<BackInStock> {
        return this.backInStockService.update(ctx, args.input);
    }
}
