import { Request } from 'express';

const NAMESPACE = 'everything-florence';

// Strip the global prefix and optional URI version segment so cache keys
// are stable regardless of routing configuration (e.g. /api/v1/products → /products).
const PATH_PREFIX_RE = /^\/api(?:\/v\d+)?/;

function normalisePath(path: string): string {
    return path.replace(PATH_PREFIX_RE, '') || '/';
}

/**
 * Builds a canonical, deterministic cache key.
 *
 * Format:
 *   everything-florence:{logical_path}:{sorted_query_string}
 *   everything-florence:{logical_path}:user:{userId}:{sorted_query_string}
 *
 * Query params are sorted alphabetically so `?page=1&limit=20` and
 * `?limit=20&page=1` always resolve to the same key.
 * Route params are already embedded in req.path (e.g. /products/my-slug).
 */
export function buildCacheKey(req: Request, userId?: string): string {
    const sortedQuery = Object.keys(req.query)
        .sort()
        .map((k) => `${k}=${req.query[k]}`)
        .join('&');

    const parts = [NAMESPACE, normalisePath(req.path)];
    if (userId) parts.push(`user:${userId}`);
    if (sortedQuery) parts.push(sortedQuery);

    return parts.join(':');
}

/**
 * Builds the glob pattern used in SCAN-based bulk invalidation.
 *
 * Examples:
 *   buildInvalidationPrefix('/products')          → everything-florence:/products*
 *   buildInvalidationPrefix('/shipping-addresses', 'abc') → everything-florence:/shipping-addresses:user:abc*
 */
export function buildInvalidationPrefix(path: string, userId?: string): string {
    const parts = [NAMESPACE, path];
    if (userId) parts.push(`user:${userId}`);
    return parts.join(':') + '*';
}
