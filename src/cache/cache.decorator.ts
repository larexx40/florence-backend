import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_KEY = 'cache:ttl';
export const CACHE_USER_SCOPED_KEY = 'cache:user_scoped';

/**
 * Marks a GET handler for caching.
 *
 * @param ttl        TTL in seconds
 * @param userScoped true → append userId from req.user to the cache key,
 *                   ensuring different users never share each other's cached data
 */
export const Cacheable = (ttl: number, userScoped = false): MethodDecorator =>
    (target, propertyKey, descriptor) => {
        SetMetadata(CACHE_TTL_KEY, ttl)(target, propertyKey, descriptor);
        SetMetadata(CACHE_USER_SCOPED_KEY, userScoped)(target, propertyKey, descriptor);
        return descriptor;
    };
