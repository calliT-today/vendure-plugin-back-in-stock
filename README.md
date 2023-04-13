# Back-In-Stock Vendure Plugin

`npm install @callit-today/vendure-plugin-back-in-stock`
and add the plugin to `vendure-config.ts`

```ts
export const config: VendureConfig = {
  // ... config options
  plugins: [BackInStockPlugin.init({ enabled: true })],
};
```

## How it works

For any product that is out of stock, customers can signup to be notified via email when the product is back in stock.
When a product is replenished, the plugin gets all active subscriptions for it and sends email notifications.

## Next steps

Implement frontend functionality. Refer to `back-in-stock` branch on [storefront-qwik-starter](https://github.com/calliT-today/storefront-qwik-starter)

## Todo

1. Customizable options for limiting number of emails sent, eg: to the amount of saleble stock, incase of limited stock availaibility for popular products. This will prevent customer disappointment if the product gets sold out again the same day of email notification sent.
2. Ability to send email notifications manually from the Admin UI, eg: when sending limited emails and the previous emails have not converted allowing other subscribers to be notified to buy the product.

## License

MIT
