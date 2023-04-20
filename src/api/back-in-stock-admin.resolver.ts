import { Args, Resolver, Query } from '@nestjs/graphql';
import { RequestContext, Ctx, PaginatedList } from '@vendure/core';
import { BackInStock } from '../entity/back-in-stock.entity';
import { BackInStockService } from '../service/back-in-stock.service';
import { QueryBackInStockSubscriptionArgs } from '../../generated/generated-admin-types';
@Resolver()
export class BackInStockAdminResolver {
    constructor(private backInStockService: BackInStockService) {}

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
}
