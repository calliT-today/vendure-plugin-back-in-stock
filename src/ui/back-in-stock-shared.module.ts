import { NgModule } from '@angular/core';
import { SharedModule, addNavMenuSection } from '@vendure/admin-ui/core';

// @ts-ignore
@NgModule({
    imports: [SharedModule],
    providers: [
        addNavMenuSection(
            {
                id: 'back-in-stock',
                label: 'Custom Plugins',
                items: [
                    {
                        id: 'back-in-stock',
                        label: 'Back-In-Stock',
                        routerLink: ['/extensions/back-in-stock'],
                        icon: 'assign-user',
                    },
                ],
            },
            // Add this section before the "settings" section
            'settings',
        ),
    ],
})
export class BackInStockSharedModule {}
