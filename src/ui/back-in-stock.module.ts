import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { BackInStockListComponent } from './components/back-in-stock-list.component';

// @ts-ignore
@NgModule({
    imports: [
        SharedModule,
        RouterModule.forChild([
            {
                path: '',
                pathMatch: 'full',
                component: BackInStockListComponent,
                data: { breadcrumb: 'Back-In-Stock Subscriptions' },
            },
        ]),
    ],
    declarations: [BackInStockListComponent],
})
export class BackInStockModule {}
