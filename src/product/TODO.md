# Product Search — Implementation Plan

Current state: plain `ILIKE` on `name` and `description` columns. No ranking, no fuzzy matching, no similarity.

---

## Phase 1 — PostgreSQL Full-Text Search + pg_trgm

Zero extra infrastructure. Lives entirely inside your existing Postgres instance.

### What you get
- Ranked results (exact title match beats partial description match)
- Stemming ("running" matches "run", "runner")
- Fuzzy tolerance via `pg_trgm` ("Nkie" → Nike, "bluoose" → blouse)
- "Similar products" query (same category, fuzzy name similarity)
- Alternatives query (different category but high name similarity)
- Works with existing pagination

### Response shape (new)
```ts
{
  status: true,
  message: 'Search results',
  data: {
    exact: Product[],       // ts_rank >= threshold, ordered by rank desc
    similar: Product[],     // same category, different product, similarity > 0.2
    alternatives: Product[] // different category, similarity > 0.2
    pagination: PaginatedData
  }
}
```

---

### Step 1 — Enable pg_trgm extension

Create a migration manually (Prisma does not manage extensions):

```sql
-- prisma/migrations/YYYYMMDDHHMMSS_enable_pg_trgm/migration.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Run with: `npx prisma migrate dev --name enable_pg_trgm`

---

### Step 2 — Add search_vector column + GIN index to products table

Create a new migration:

```sql
-- Add generated tsvector column covering name (weight A) + description (weight B)
ALTER TABLE products
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) STORED;

-- GIN index for fast FTS queries
CREATE INDEX idx_products_search_vector ON products USING GIN (search_vector);

-- Trigram index on name for fuzzy similarity queries
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
```

> The `GENERATED ALWAYS AS ... STORED` column auto-updates whenever `name` or `description` changes — no manual sync needed.

No Prisma schema change is needed (Prisma ignores generated columns). Run: `npx prisma migrate dev --name add_product_search_vector`

---

### Step 3 — Create `src/product/product.search.ts` helper

Write a module-local helper (not injectable, not a class — just exported functions):

```ts
// src/product/product.search.ts

export function buildFtsQuery(search: string): string {
  // converts "running shoes" → "running & shoes"
  // handles special tsquery chars to avoid injection
  return search
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .join(' & ');
}
```

---

### Step 4 — Add `searchProducts` method to `ProductService`

Replace the `ILIKE` search branch inside `getAll` with a call to a new dedicated method:

**`searchProducts(query: ProductQueryDto)`**

Uses two raw Prisma queries:

**Query A — ranked FTS results (the main result)**
```sql
SELECT p.id, ts_rank(p.search_vector, to_tsquery('english', $1)) AS rank
FROM products p
WHERE p.is_active = true
  AND p.search_vector @@ to_tsquery('english', $1)
ORDER BY rank DESC
LIMIT $2 OFFSET $3;
```

**Query B — similar products (same category, fuzzy name)**
```sql
SELECT p.id, similarity(p.name, $1) AS sim
FROM products p
WHERE p.is_active = true
  AND p.id != ANY($2)           -- exclude ids already in main results
  AND p.category_id = $3        -- same category as top result
  AND similarity(p.name, $1) > 0.15
ORDER BY sim DESC
LIMIT 8;
```

**Query C — alternatives (different category, fuzzy name)**
```sql
SELECT p.id, similarity(p.name, $1) AS sim
FROM products p
WHERE p.is_active = true
  AND p.id != ANY($2)
  AND p.category_id != $3
  AND similarity(p.name, $1) > 0.15
ORDER BY sim DESC
LIMIT 8;
```

After getting IDs from all three raw queries, fetch full product records via Prisma `findMany({ where: { id: { in: ids } }, include: PRODUCT_LIST_INCLUDE })` — this keeps Prisma's type safety for the include shape.

---

### Step 5 — Update `getAll` in ProductService

```ts
async getAll(query: ProductQueryDto) {
  if (query.search) {
    return this.searchProducts(query); // delegates to FTS path
  }
  // existing ILIKE-free browse path stays untouched
}
```

---

### Step 6 — Update `ProductQueryDto`

No new fields needed — `search` already exists. Optionally add:
- `searchMode?: 'fts' | 'simple'` — lets you fall back to ILIKE if needed during rollout

---

### Step 7 — Cache invalidation

Search results should NOT be cached (results are query-specific, pagination varies, and stale results after a product update would be confusing). The existing `@Cacheable` decorator on `getAll` must be skipped when `query.search` is present.

In the interceptor, check for the `search` param and skip caching if present, OR handle it in the controller by not applying `@Cacheable` to a dedicated `GET /products/search` route.

**Recommended:** Add a separate `GET /products/search` endpoint (not cached) and keep `GET /products` for browse (cached).

---

### Step 8 — Add `GET /products/search` route to controller

```ts
@Get('search')
@ApiOperation({ summary: 'Search products with FTS ranking + similar/alternative results' })
@ApiQuery({ name: 'search', required: true })
@ApiQuery({ name: 'page', required: false })
@ApiQuery({ name: 'limit', required: false })
@ApiResponse({ status: 200, description: 'Ranked search results with similar and alternative products' })
async search(@Query() query: ProductQueryDto) {
  return this.productService.searchProducts(query);
}
```

---

### Step 9 — Test checklist

- [ ] `GET /products/search?search=shoe` returns ranked results
- [ ] `GET /products/search?search=nkie` returns Nike products (trigram fuzzy)
- [ ] `similar` array contains same-category products not in `exact`
- [ ] `alternatives` array contains different-category products
- [ ] Empty `search` query returns 400
- [ ] `ts_rank` ordering is highest first
- [ ] No duplicate product IDs across `exact`, `similar`, `alternatives`
- [ ] Pagination works on `exact` results

---

## Phase 2 — AI Semantic / Vector Search (pgvector)

Do this after Phase 1 is stable and you have enough product descriptions to benefit from semantic understanding.

**Best for:** intent-based queries ("comfortable everyday bag", "gift for a new mother") where no keyword matches.

---

### Step 1 — Enable pgvector extension

```sql
-- prisma/migrations/YYYYMMDDHHMMSS_enable_pgvector/migration.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

### Step 2 — Add embedding column to products

```sql
-- 1536 dimensions = OpenAI text-embedding-3-small output size
ALTER TABLE products ADD COLUMN embedding vector(1536);

-- HNSW index for approximate nearest-neighbour search (fast at scale)
CREATE INDEX idx_products_embedding ON products USING hnsw (embedding vector_cosine_ops);
```

---

### Step 3 — Choose and configure embedding provider

**Recommended: OpenAI `text-embedding-3-small`**
- Cost: ~$0.02 per 1M tokens
- 1536 dimensions
- Add `OPENAI_API_KEY` to `.env`

Install: `yarn add openai`

Create `src/common/helpers/embedding.helper.ts`:

```ts
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // token limit safety
  });
  return res.data[0].embedding;
}
```

---

### Step 4 — Backfill existing products

Write a one-off script `prisma/scripts/backfill-embeddings.ts`:

```
for each product (in batches of 50):
  text = `${product.name}. ${product.description ?? ''}`
  embedding = await generateEmbedding(text)
  UPDATE products SET embedding = $embedding WHERE id = $id
  sleep 100ms  // respect OpenAI rate limit
```

Run once: `ts-node prisma/scripts/backfill-embeddings.ts`

---

### Step 5 — Keep embeddings in sync

In `ProductService.create()` and `ProductService.update()`:

```ts
// fire-and-forget after the product is saved — never block the response
this.syncEmbedding(product.id, product.name, product.description).catch((err) =>
  this.logger.warn(`Embedding sync failed for ${product.id}: ${err.message}`)
);
```

`syncEmbedding` generates the embedding and runs a raw `UPDATE`.

> Alternative: push to a Bull queue so embedding generation doesn't slow down admin mutations at all.

---

### Step 6 — Add `vectorSearch` method to ProductService

```sql
SELECT id, 1 - (embedding <=> $1::vector) AS cosine_similarity
FROM products
WHERE is_active = true
  AND embedding IS NOT NULL
ORDER BY embedding <=> $1::vector   -- cosine distance ascending = most similar first
LIMIT 20;
```

Inputs: `$1` = embedding of the user's search string (generated on the fly per request).

---

### Step 7 — Combine FTS + vector in `searchProducts`

Run FTS (Phase 1) and vector search in parallel (`Promise.all`). Merge and re-rank:

```
score = (fts_rank * 0.4) + (cosine_similarity * 0.6)
```

Weights are tunable. Products only in vector results (semantic match, no keyword) get `fts_rank = 0`. Products only in FTS results get `cosine_similarity = 0`.

Deduplicate by ID, sort by merged score, then paginate.

---

### Step 8 — Caching for vector search

Vector search results for a given query string can be cached with a short TTL (60–120s) using the existing `CacheService`. Cache key: `everything-florence:/products/search:q={normalised_query}`.

Normalise the query before building the key: lowercase, trim, collapse whitespace.

---

### Step 9 — Test checklist

- [ ] `GET /products/search?search=comfortable bag for work` returns semantically relevant products even without keyword match
- [ ] Embedding is generated and stored on product create/update
- [ ] Backfill script completes without rate-limit errors
- [ ] `embedding IS NOT NULL` guard prevents null-vector rows from poisoning results
- [ ] Merged score favours products that appear in both FTS and vector results
- [ ] HNSW index is used (check with `EXPLAIN ANALYSE`)

---

## Order of implementation

1. Phase 1, Steps 1–6 (core FTS plumbing)
2. Phase 1, Steps 7–8 (routing + no-cache for search)
3. Phase 1, Step 9 (test)
4. Phase 2, Steps 1–4 (infra + backfill) — only after catalog has 50+ products with real descriptions
5. Phase 2, Steps 5–7 (sync + combined ranking)
6. Phase 2, Steps 8–9 (cache + test)
