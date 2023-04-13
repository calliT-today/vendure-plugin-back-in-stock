import { Inject } from '@nestjs/common';
import { Args, Resolver, Query } from '@nestjs/graphql';
import { RequestContext, Ctx, PaginatedList } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { BackInStockOptions } from '../back-in-stock.plugin';
import { BackInStock } from '../entity/back-in-stock.entity';
import { BackInStockService } from '../service/back-in-stock.service';

@Resolver()
export class BackInStockAdminResolver {
    constructor(
        // @ts-ignore
        @Inject(PLUGIN_INIT_OPTIONS) private options: BackInStockOptions,
        private backInStockService: BackInStockService,
    ) {}

    @Query()
    async backInStockSubscriptions(
        @Ctx() ctx: RequestContext,
        @Args() args: any,
    ): Promise<PaginatedList<BackInStock>> {
        return this.backInStockService.findAll(ctx, args.options);
    }
}
