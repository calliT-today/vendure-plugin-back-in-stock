import gql from 'graphql-tag';

export const BACKINSTOCK_FRAGMENT = gql`
    fragment BackInStock on BackInStock {
        id
        createdAt
        updatedAt
        status
        email
        productVariant {
            id
            name
            stockOnHand
        }
        customer {
            id
        }
    }
`;

export const GET_BACKINSTOCK_SUBSCRIPTION_LIST = gql`
    query GetBackInStockSubscriptionList($options: BackInStockListOptions) {
        backInStockSubscriptions(options: $options) {
            items {
                ...BackInStock
            }
            totalItems
        }
    }
    ${BACKINSTOCK_FRAGMENT}
`;
