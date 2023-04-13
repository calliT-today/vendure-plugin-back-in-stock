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
                        // Icon can be any of https://core.clarity.design/foundation/icons/shapes/
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
