import {
    SimpleGraphQLClient
} from '@vendure/testing';
import { gql } from 'graphql-tag';
import { CreateBackInStockSubscriptionResult } from '../src/ui/generated/graphql-shop-api-types';
import { ProductVariant } from '@vendure/core';
import { UpdateProductVariantInput } from '../src/ui/generated/graphql-admin-api-types';

export async function createBackInStockSubscription(shopClient: SimpleGraphQLClient, email: string, variantId: string): Promise<CreateBackInStockSubscriptionResult> {
    const { createBackInStockSubscription } = await shopClient.query(gql`
        mutation createBackInStockSubscription($email: String!, $variantId: ID!) {
        createBackInStockSubscription(
          input: { email: $email, productVariantId: $variantId }
        ) {
          __typename
          ... on BackInStock {
            id
            status
            productVariant {
              id
            }
            email
          }
        }
      }
    `, {
        email, variantId
    });
    return createBackInStockSubscription;
}

export async function getActiveOrder(shopClient: SimpleGraphQLClient): Promise<void> {
    await shopClient.query(gql`
    {
        activeOrder {
            id
            code
        }
    }
    `);
}

export async function updateVariants(
    adminClient: SimpleGraphQLClient,
    input: UpdateProductVariantInput[]
): Promise<ProductVariant[]> {
    const { updateProductVariants } = await adminClient.query(gql`
        mutation UpdateProductVariants($input: [UpdateProductVariantInput!]!) {
            updateProductVariants(input: $input) {
                id
                name
                sku
                stockAllocated
                stockOnHand
            }
        }
    `,
        { input }
    );
    return updateProductVariants;
}