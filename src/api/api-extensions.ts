import { gql } from 'graphql-tag';

// // These scalars act as mocks to support static Graphql type generation
// const scalars = gql`
//     scalar Node
//     scalar DateTime
//     scalar ProductVariant
//     scalar Channel
//     scalar Customer
//     scalar ErrorResult
//     scalar ErrorCode
//     scalar PaginatedList
// `;

export const commonApiExtensions = gql`
    type BackInStock implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        status: BackInStockSubscriptionStatus!
        productVariant: ProductVariant!
        channel: Channel!
        customer: Customer
        email: String!
    }

    enum BackInStockSubscriptionStatus {
        Created
        Notified
        Converted
    }

    input CreateBackInStockInput {
        email: String!
        productVariantId: ID!
    }

    input UpdateBackInStockInput {
        id: ID!
        status: BackInStockSubscriptionStatus!
    }

    input ProductVariantInput {
        productVariantId: ID!
    }

    type BackInStockList implements PaginatedList {
        items: [BackInStock!]!
        totalItems: Int!
    }

    union CreateBackInStockSubscriptionResult = BackInStock | BackInStockAlreadySubscribedError

    type BackInStockAlreadySubscribedError implements ErrorResult {
        errorCode: ErrorCode!
        message: String!
    }

    extend type Query {
        activeBackInStockSubscriptionForProductVariantWithCustomer(
            input: CreateBackInStockInput!
        ): BackInStock!
    }

    extend type Mutation {
        createBackInStockSubscription(input: CreateBackInStockInput!): CreateBackInStockSubscriptionResult!
    }
`;

export const shopApiExtensions = gql`
    ${commonApiExtensions}
`;

export const adminApiExtensions = gql`
    extend type Query {
        activeBackInStockSubscriptionsForProductVariant(input: ProductVariantInput): BackInStockList!
        backInStockSubscription(id: ID!): BackInStock
        backInStockSubscriptions: BackInStockList!
    }
    extend type Mutation {
        updateBackInStockSubscription(input: UpdateBackInStockInput!): BackInStock!
    }
    ${commonApiExtensions}
`;
