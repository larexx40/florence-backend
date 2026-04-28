import slugify from 'slugify';

export function toSlug(name: string): string {
  return slugify(name, { lower: true, strict: true, trim: true });
}

/**
 * Generates a slug from `name` and appends a numeric suffix until unique.
 * `exists` is called with each candidate — return true if already taken.
 */
export async function generateUniqueSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = toSlug(name);
  if (!(await exists(base))) return base;

  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${base}-${counter}`;
    if (!(await exists(candidate))) return candidate;
    counter++;
  }
}

/**
 * Generates a human-readable, unique SKU for a product variant.
 *
 * Format: `{PRODUCT-SLUG}-{VALUE1}-{VALUE2}-...` in uppercase.
 * Example: product "Buffalo Loafer", options Black + 36 → `BUFFALO-LOAFER-BLACK-36`
 * If that SKU is taken, appends a counter: `BUFFALO-LOAFER-BLACK-36-2`.
 *
 * @param productSlug  The product's slug (e.g. "buffalo-loafer")
 * @param optionValues Option values sorted by option name (e.g. ["Black", "36"])
 * @param exists       Called with each candidate — return true if already taken
 */
export async function generateVariantSku(
  productSlug: string,
  optionValues: string[],
  exists: (sku: string) => Promise<boolean>,
): Promise<string> {
  const sanitise = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const parts = [productSlug, ...optionValues].map(sanitise).filter(Boolean);
  const base = parts.join('-');

  if (!(await exists(base))) return base;

  let counter = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${base}-${counter}`;
    if (!(await exists(candidate))) return candidate;
    counter++;
  }
}
