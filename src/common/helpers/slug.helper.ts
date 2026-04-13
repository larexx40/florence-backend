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
