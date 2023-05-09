import { Args, Resolver, Query, Mutation } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { RequestContext, Ctx, ErrorResultUnion, PLUGIN_INIT_OPTIONS, ForbiddenError } from '@vendure/core';
import { BackInStock } from '../entity/back-in-stock.entity';
import { BackInStockService } from '../service/back-in-stock.service';
import {
    MutationCreateBackInStockSubscriptionArgs,
    QueryActiveBackInStockSubscriptionForProductVariantWithCustomerArgs,
    CreateBackInStockSubscriptionResult,
} from '../../generated/generated-shop-types';
import { BackInStockOptions } from '../back-in-stock.plugin';

@Resolver()
export class BackInStockResolver {
    constructor(
        private backInStockService: BackInStockService,
        @Inject(PLUGIN_INIT_OPTIONS) private options: BackInStockOptions
    ) { }

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
        if (!this.options.allowSubscriptionWithoutSession && ctx.session === undefined) {
            throw new ForbiddenError();
        }
        return this.backInStockService.create(ctx, args.input);
    }
}
