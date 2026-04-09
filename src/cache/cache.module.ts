import { Global, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './cache.interceptor';

@Global()
@Module({
    providers: [CacheService, CacheInterceptor, Reflector],
    exports: [CacheService, CacheInterceptor],
})
export class AppCacheModule {}
