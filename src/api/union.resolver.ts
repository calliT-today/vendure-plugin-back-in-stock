import { ResolveField, Resolver } from '@nestjs/graphql';

@Resolver('CreateBackInStockSubscriptionResult')
export class UnionResolver {
    @ResolveField()
    __resolveType(value: any): string {
        // If it has an "id" property we can assume it is an entity.
        return value.hasOwnProperty('id') ? 'BackInStock' : 'BackInStockAlreadySubscribedError';
    }
}
