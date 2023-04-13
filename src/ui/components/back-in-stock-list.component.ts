import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BaseListComponent, DataService } from '@vendure/admin-ui/core';
import {
    BackInStock,
    BackInStockSubscriptionStatus,
    GetBackInStockSubscriptionList,
    SortOrder,
} from '../../../generated/generated-types';
import { GET_BACKINSTOCK_SUBSCRIPTION_LIST } from './back-in-stock-list.graphql';

// @ts-ignore
@Component({
    selector: 'back-in-stock-list',
    templateUrl: './back-in-stock-list.component.html',
    styleUrls: ['./back-in-stock-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackInStockListComponent extends BaseListComponent<
    GetBackInStockSubscriptionList.Query,
    GetBackInStockSubscriptionList.Items,
    GetBackInStockSubscriptionList.Variables
> {
    filteredStatus: BackInStockSubscriptionStatus | null = BackInStockSubscriptionStatus.Created;

    constructor(private dataService: DataService, router: Router, route: ActivatedRoute) {
        super(router, route);
        super.setQueryFn(
            (...args: any[]) => {
                return this.dataService.query<GetBackInStockSubscriptionList.Query>(
                    GET_BACKINSTOCK_SUBSCRIPTION_LIST,
                    args,
                );
            },
            data => data.backInStockSubscriptions,
            (skip, take) => {
                return {
                    options: {
                        skip,
                        take,
                        sort: {
                            createdAt: SortOrder.ASC,
                        },
                        ...(this.filteredStatus != null
                            ? {
                                  filter: {
                                      status: {
                                          eq: this.filteredStatus,
                                      },
                                  },
                              }
                            : {}),
                    },
                };
            },
        );
    }
}
