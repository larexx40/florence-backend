// One-off scraper — run with: node prisma/scrape.js
// Fetches the live Shopify storefront, cleans data to match the Florence schema,
// and overwrites prisma/data/shopify-data.json.

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── HTTP helper ───────────────────────────────────────────────────────────────

function get(urlPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'everythingflorences.myshopify.com',
      path:     urlPath,
      headers:  { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    };
    https.get(opts, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try   { resolve(JSON.parse(body)); }
        catch { reject(new Error(`JSON parse failed for ${urlPath}: ${body.slice(0, 120)}`)); }
      });
    }).on('error', reject);
  });
}

async function paginate(base) {
  const all  = [];
  let   page = 1;
  while (true) {
    const d     = await get(`${base}&page=${page}`);
    const items = d.products || [];
    all.push(...items);
    if (items.length < 250) break;
    page++;
    await new Promise(r => setTimeout(r, 400));
  }
  return all;
}

// ── Option name normaliser ────────────────────────────────────────────────────
// Must mirror the logic in seed.runner.ts so option values resolve correctly.

const SKIP_OPTS = new Set(['title', 'price', 'code']);

function normaliseOption(raw) {
  const l = raw.toLowerCase().trim();
  if (SKIP_OPTS.has(l))      return null;
  if (/colou?rs?l?/.test(l)) return 'Color';
  if (/sizes?/.test(l))      return 'Size';
  if (/quantity/.test(l))    return 'Quantity';
  if (/model/.test(l))       return 'Model';
  return raw.trim();
}

// ── Category assignment ───────────────────────────────────────────────────────

// Explicit slug → category overrides for products the Shopify collections
// do not cover and the generic heuristic cannot reliably assign.
const SLUG_OVERRIDE = {
  'fruit-knife':                        'home-kitchen',
  'tongue-scrapper':                    'home-kitchen',
  'knife-set':                          'home-kitchen',
  'bowl-3pcs':                          'home-kitchen',
  'big-basket':                         'home-kitchen',
  'laundry-basket-2':                   'home-kitchen',
  'double-wall-holder':                 'home-kitchen',
  'raf-single-blender-preorder-3month': 'home-kitchen',
  'air-fryer-1':                        'home-kitchen',
  'usb-fan-ios-only':                   'home-kitchen',
  'wall-hook':                          'home-kitchen',
  'manicure-set-1':                     'home-kitchen',
  'dyb-bottle':                         'home-kitchen',
  'deer-alarm-clock':                   'home-kitchen',
  'storage-box-1':                      'home-kitchen',
  'manicure-set-big':                   'home-kitchen',
  'aurora-spray-mob':                   'home-kitchen',
  'trolley':                            'home-kitchen',
  'sliver-crest-air-fryer':             'home-kitchen',
  'hand-cream-b':                       'home-kitchen',
  'lip-oil':                            'home-kitchen',
  'sun-screen':                         'home-kitchen',
  'carton-deal':                        'home-kitchen',
  'aromantic-scent':                    'home-kitchen',
  'labubu':                             'home-kitchen',
  '2pcs-foot-mat':                      'home-kitchen',
  'storage-box':                        'home-kitchen',
  'foot-mask':                          'home-kitchen',
  'hand-mask':                          'home-kitchen',
  'apron':                              'home-kitchen',
  'knife-organizer':                    'home-kitchen',
  'wall-hanger':                        'home-kitchen',
  'usb-light':                          'home-kitchen',
  'spice-rack-1':                       'home-kitchen',
  'seive-bowl':                         'home-kitchen',
  '5layers-dehydrator':                 'home-kitchen',
};

// Products that are not real merchandise and should be skipped entirely.
const SKIP_SLUGS = new Set(['delivery']);

function inferCategory(product) {
  if (SLUG_OVERRIDE[product.handle]) return SLUG_OVERRIDE[product.handle];
  const name   = product.title.toLowerCase();
  const handle = product.handle.toLowerCase();
  // SFLO = Shoes Florence, BFLO = Bags Florence — check both handle and name
  if (/^sflo/.test(handle) || /\bsflo\b/.test(name))                   return 'shoes';
  if (/^bflo/.test(handle) || /\bbflo\b/.test(name))                   return 'bags';
  if (/slipper|flip.?flop|sandal/.test(name))                          return 'slippers';
  if (/phone|case|charger|cable|earphone|earpiece|airpod/.test(name))  return 'phone-accessories';
  if (/shoe|heel|sneaker|boot|loafer|stiletto/.test(name))             return 'shoes';
  if (/bag|tote|purse|clutch|handbag/.test(name))                      return 'bags';
  if (/cup|knife|basket|blender|fryer|bowl|rack|hook|cookware|zepter/.test(name)) return 'home-kitchen';
  return 'uncategorized';
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('Fetching products and collections in parallel…');

  const [allProducts, collectionsResp, bagsCol, phoneCol, slipCol, bestCol] = await Promise.all([
    paginate('/products.json?limit=250'),
    get('/collections.json?limit=250'),
    paginate('/collections/frontpage/products.json?limit=250'),
    paginate('/collections/phone-accessories/products.json?limit=250'),
    paginate('/collections/slippers/products.json?limit=250'),
    paginate('/collections/best-sellers/products.json?limit=250'),
  ]);

  console.log(`Fetched ${allProducts.length} products total.`);

  // Build id → category from collection membership (collection wins over heuristic)
  const collectionCategory = {};
  const assign = (arr, cat) => arr.forEach(p => { if (!collectionCategory[p.id]) collectionCategory[p.id] = cat; });
  assign(phoneCol, 'phone-accessories');
  assign(slipCol,  'slippers');
  assign(bagsCol,  'bags');

  const bestSellerIds = new Set(bestCol.map(p => p.id));

  // ── Build clean product list ─────────────────────────────────────────────

  const products = [];

  for (const p of allProducts) {
    if (SKIP_SLUGS.has(p.handle)) continue;

    const category = collectionCategory[p.id] || inferCategory(p);

    // ── Options ────────────────────────────────────────────────────────────
    const cleanOptions = [];
    for (const opt of (p.options || [])) {
      const normName = normaliseOption(opt.name);
      if (!normName) continue;
      const values = (opt.values || []).filter(v => v && v !== 'Default Title');
      if (values.length === 0) continue;
      cleanOptions.push({ name: normName, values });
    }

    // ── Variants ───────────────────────────────────────────────────────────
    const optionNames = (p.options || []).map(o => o.name);
    const cleanVariants = [];

    for (const v of (p.variants || [])) {
      const rawVals = [v.option1, v.option2, v.option3];

      // Build display title from non-skipped, non-default option values
      const titleParts = rawVals.filter((val, i) => {
        if (!val || val === 'Default Title') return false;
        return normaliseOption(optionNames[i] || '') !== null;
      });
      const title = titleParts.join(' / ') || p.title;

      // Build selectedOptions for VariantOptionValue linkage
      const selectedOptions = [];
      for (let i = 0; i < optionNames.length; i++) {
        const normName = normaliseOption(optionNames[i]);
        if (!normName) continue;
        if (!rawVals[i] || rawVals[i] === 'Default Title') continue;
        selectedOptions.push({ optionName: normName, value: rawVals[i] });
      }

      // SKU: prefer existing Shopify SKU, fall back to handle+variantId
      const sku = (v.sku && v.sku.trim()) ? v.sku.trim() : `${p.handle}-v${v.id}`;

      cleanVariants.push({
        sku,
        title,
        price:          parseFloat(v.price || '0'),
        compareAtPrice: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
        // Shopify public API does not expose inventory_quantity; derive from available flag.
        // Use 50 as a realistic seed quantity for available variants.
        stockQty:       v.available === true ? 50 : 0,
        isActive:       true,
        weightKg:       v.grams ? +(v.grams / 1000).toFixed(3) : null,
        selectedOptions,
      });
    }

    if (cleanVariants.length === 0) continue;

    // ── Images ─────────────────────────────────────────────────────────────
    const cleanImages = (p.images || []).map(img => ({
      url:      img.src,
      altText:  img.alt || null,
      position: img.position ?? 1,
    }));

    // Strip HTML tags from description, collapse whitespace
    const description = p.body_html
      ? p.body_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || null
      : null;

    products.push({
      category,
      product: {
        name:           p.title,
        slug:           p.handle,
        description,
        isActive:       true,
        isFeatured:     false,
        isBestSeller:   bestSellerIds.has(p.id),
        minOrderQty:    1,
        orderIncrement: null,
      },
      images:   cleanImages,
      options:  cleanOptions,
      variants: cleanVariants,
    });
  }

  // ── Category breakdown ───────────────────────────────────────────────────

  const categoryBreakdown = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});

  const totalVariants = products.reduce((n, p) => n + p.variants.length, 0);

  // ── Collections metadata ─────────────────────────────────────────────────

  const collections = (collectionsResp.collections || []).map(c => ({
    name:        c.title,
    slug:        c.handle,
    description: c.description || null,
    imageUrl:    c.image       || null,
  }));

  // ── Write output ─────────────────────────────────────────────────────────

  const output = {
    generatedAt:       new Date().toISOString(),
    sourceStore:       'https://everythingflorences.myshopify.com',
    note:              'Scraped via public Shopify JSON API. stockQty derived from availability flag (50=available, 0=unavailable).',
    totalProducts:     products.length,
    totalVariants,
    categoryBreakdown,
    collections,
    products,
  };

  const outPath = path.join(__dirname, 'data', 'shopify-data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log('\nDone!');
  console.log('Output:', outPath);
  console.log(JSON.stringify({ totalProducts: products.length, totalVariants, categoryBreakdown }, null, 2));
})().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
