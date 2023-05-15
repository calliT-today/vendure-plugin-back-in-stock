import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BaseListComponent, DataService, NotificationService, ItemOf } from '@vendure/admin-ui/core';
import { BackInStockSubscriptionStatus, GetBackInStockSubscriptionListQuery, GetBackInStockSubscriptionListQueryVariables, SortOrder } from '../generated/graphql-admin-api-types';
import { GET_BACKINSTOCK_SUBSCRIPTION_LIST } from './back-in-stock-list.graphql';
import { gql } from 'graphql-tag';
import { ID } from '@vendure/core';

// @ts-ignore
@Component({
    selector: 'back-in-stock-list',
    templateUrl: './back-in-stock-list.component.html',
    styleUrls: ['./back-in-stock-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackInStockListComponent extends BaseListComponent<
    GetBackInStockSubscriptionListQuery,
    ItemOf<GetBackInStockSubscriptionListQuery, 'backInStockSubscriptions'>,
    GetBackInStockSubscriptionListQueryVariables
> {
    filteredStatus: BackInStockSubscriptionStatus | null = BackInStockSubscriptionStatus.Created;

    constructor(
        private dataService: DataService,
        protected notificationService: NotificationService,
        router: Router,
        route: ActivatedRoute,
    ) {
        super(router, route);
        super.setQueryFn(
            (...args: any[]) => {
                return this.dataService.query<GetBackInStockSubscriptionListQuery>(
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
                            createdAt: SortOrder.Asc,
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

    async notify(id: ID): Promise<void> {
        try {
            await this.dataService
                .mutate(
                    gql`
                        mutation {
                            updateBackInStockSubscription(input: {id: "${id}", status: Notified}) {
                                id
                                status
                            }
                        }
                    `,
                )
                .toPromise();
            this.notificationService.success('Notification email sent');
            this.refresh();
        } catch (e) {
            this.notificationService.error('Error');
        }
    }
}
