# Back-In-Stock Vendure Plugin

![Vendure version](https://img.shields.io/npm/dependency-version/@callit-today/vendure-plugin-back-in-stock/dev/@vendure/core)

Keep your customers in the loop for when a sold-out product gets replenished and generate more revenue by adding potential future sales!

## Getting started

`yarn add @callit-today/vendure-plugin-back-in-stock`

`yarn add -D @vendure/ui-devkit`

Add the plugin and AdminUI extensions to the plugins object in `vendure-config.ts`

```ts
export const config: VendureConfig = {
  // ... config options
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
  BackInStockPlugin.init({ enabled: true }),
};
```

## How it works

For any product that is out of stock, customers can signup to be notified via email when the product is back in stock.
When a product is replenished, the plugin gets all active subscriptions for it and sends email notifications.

## Next steps

Implement frontend functionality. Refer to `back-in-stock` branch on [storefront-qwik-starter](https://github.com/calliT-today/storefront-qwik-starter)

## Todo

1. Customizable options for limiting number of emails sent, eg: to the amount of saleable stock, incase of limited stock availaibility for popular products. This will prevent customer disappointment if the product gets sold out again the same day of email notification being sent.
2. Ability to send email notifications manually from the Admin UI, eg: when sending limited emails and the previous emails have not converted allowing other subscribers to be notified to buy the product.

## License

MIT
