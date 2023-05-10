import { InitialData, LanguageCode, PaymentMethodHandler } from "@vendure/core";

export const initialData: InitialData = {
  defaultLanguage: LanguageCode.en,
  defaultZone: "NL",
  taxRates: [
    { name: "Standard Tax", percentage: 21 },
    { name: "Reduced Tax", percentage: 9 },
    { name: "Zero Tax", percentage: 0 },
  ],
  shippingMethods: [
    { name: "default shipping", price: 500 },
    { name: "shipping by zone", price: 600 },
  ],
  paymentMethods: [],
  countries: [{ name: "Nederland", code: "NL", zone: "NL" }],
  collections: [
    {
      name: "Electronics",
      filters: [
        {
          code: "facet-value-filter",
          args: { facetValueNames: ["electronics"], containsAny: false },
        },
      ],
    },
  ],
};
