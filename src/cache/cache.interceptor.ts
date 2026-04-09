import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, tap } from 'rxjs';
import { CacheService } from './cache.service';
import { buildCacheKey } from './cache-key.util';
import { CACHE_TTL_KEY, CACHE_USER_SCOPED_KEY } from './cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
    constructor(
        private readonly cacheService: CacheService,
        private readonly reflector: Reflector,
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest();

        // Only cache GET requests
        if (request.method !== 'GET') return next.handle();

        // Only cache handlers decorated with @Cacheable
        const ttl = this.reflector.get<number>(CACHE_TTL_KEY, context.getHandler());
        if (!ttl) return next.handle();

        const userScoped = this.reflector.get<boolean>(CACHE_USER_SCOPED_KEY, context.getHandler());

        let userId: string | undefined;
        if (userScoped) {
            userId = request.user?.userId;
            // Auth guard should have already rejected unauthenticated requests,
            // but if userId is somehow missing, skip caching rather than mixing users
            if (!userId) return next.handle();
        }

        const cacheKey = buildCacheKey(request, userId);

        // Cache HIT — return immediately, handler never executes
        const cached = await this.cacheService.get(cacheKey);
        if (cached !== null) {
            return of(cached);
        }

        // Cache MISS — run handler, then store the response
        return next.handle().pipe(
            tap(async (response) => {
                if (response !== null && response !== undefined) {
                    await this.cacheService.set(cacheKey, response, ttl);
                }
            }),
        );
    }
}
