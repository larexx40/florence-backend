import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
    private readonly logger = new Logger(CacheService.name);
    private readonly client: Redis;

    constructor(private readonly config: ConfigService) {
        this.client = new Redis({
            host: this.config.get<string>('REDIS_HOST', 'localhost'),
            port: this.config.get<number>('REDIS_PORT', 6379),
            password: this.config.get<string>('REDIS_PASSWORD') || undefined,
            // Back off up to 3 s between reconnect attempts
            retryStrategy: (times) => Math.min(times * 100, 3000),
            // Drop pending commands instead of queuing them during an outage —
            // the app degrades to live DB reads rather than spiking on reconnect
            enableOfflineQueue: false,
        });

        this.client.on('connect', () => this.logger.log('Redis connected'));
        this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const raw = await this.client.get(key);
            if (!raw) return null;
            return JSON.parse(raw) as T;
        } catch (err) {
            this.logger.warn(`Cache GET failed for "${key}": ${err.message}`);
            return null;
        }
    }

    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        try {
            await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch (err) {
            this.logger.warn(`Cache SET failed for "${key}": ${err.message}`);
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.client.del(key);
        } catch (err) {
            this.logger.warn(`Cache DEL failed for "${key}": ${err.message}`);
        }
    }

    /**
     * Invalidates all keys matching a glob pattern using cursor-based SCAN.
     * Never uses KEYS — safe on large keyspaces and non-blocking.
     *
     * @param pattern  e.g. "everything-florence:/products*"
     */
    async invalidateByPrefix(pattern: string): Promise<void> {
        try {
            const keysToDelete: string[] = [];
            let cursor = '0';

            do {
                const [nextCursor, keys] = await this.client.scan(
                    cursor,
                    'MATCH',
                    pattern,
                    'COUNT',
                    100,
                );
                cursor = nextCursor;
                keysToDelete.push(...keys);
            } while (cursor !== '0');

            if (keysToDelete.length > 0) {
                await this.client.del(...keysToDelete);
                this.logger.log(`Invalidated ${keysToDelete.length} cache key(s) matching "${pattern}"`);
            }
        } catch (err) {
            this.logger.warn(`Cache invalidation failed for pattern "${pattern}": ${err.message}`);
        }
    }

    onModuleDestroy() {
        this.client.disconnect();
    }
}
