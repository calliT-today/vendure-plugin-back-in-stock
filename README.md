## Back-In-Stock Vendure Plugin

![Vendure version](https://img.shields.io/npm/dependency-version/@callit-today/vendure-plugin-back-in-stock/dev/@vendure/core)

Keep your customers in the loop for when a sold-out product gets replenished and generate more revenue by adding potential future sales!



# Getting started

`yarn add @callit-today/vendure-plugin-back-in-stock`

`yarn add -D @vendure/ui-devkit`

\
&nbsp;
Add the plugin, email handler and AdminUI extensions to `plugins` in `vendure-config.ts`

```ts
export const config: VendureConfig = {
  // .. config options
  plugins: [
    BackInStockPlugin.init({ enableEmail: true, limitEmailToStock: false }),
    EmailPlugin.init({
      // .. email config
      handlers: [...defaultEmailHandlers, backInStockNotificationHandler]
    )},
    AdminUiPlugin.init({
      route: 'admin',
      port: 3002,
      adminUiConfig: {
          apiHost: 'http://localhost',
          apiPort: 3000,
      },
      app: compileUiExtensions({
          outputPath: path.join(__dirname, '../admin-ui'),
          extensions: [BackInStockPlugin.uiExtensions],
      }),
    }),
  ],
};
```
\
&nbsp;
Create a template file for the Back-In-Stock email in `static/email/templates/back-in-stock/body.hbs`

```hbs
{{> header title="{{productVariant.name}} - Back In Stock!" }}

<mj-section background-color="#fafafa">
    <mj-column>
        <mj-text color="#525252">
            {{ productVariant.name }} is now back in stock!
        </mj-text>

        <mj-button font-family="Helvetica"
                   background-color="#f45e43"
                   color="white"
                   href="{{ url }}/{{ productVariant.product.slug }}">
            View Product
        </mj-button>

    </mj-column>
</mj-section>

{{> footer }}
```
&nbsp;

## How it works

For any product that is out of stock, customers can signup to be notified via email when the product is back in stock.
When a product is replenished, the plugin gets active subscriptions for it and sends email notifications.

Disable email notifications by setting `enableEmail` to `false` in plugin `init`
\
For limiting notifications sent to the amount of saleable stock set `limitEmailToStock` to `true`

&nbsp;

## Next steps

Implement frontend functionality. Refer to `back-in-stock` branch on [storefront-qwik-starter](https://github.com/calliT-today/storefront-qwik-starter)

&nbsp;

## Todo

:white_check_mark: Customizable options for disabling email notifications and sending emails to the amount of saleable stock

:white_check_mark: Ability to send email notifications manually from the Admin UI

:soon: Dashboard with metrics and tracking conversions

\
&nbsp;

## License

MIT
