// ── SKU format: {CAT}-{PRODUCT}-{OPT_VAL_1}-{OPT_VAL_2}-...
//
// Examples:
//   category=Bags, product=BFLO 226, Color=Black              → BAG-BFLO226-BLACK
//   category=Bags, product=Apron, Pack Size=3pcs              → BAG-APRON-3PCS
//   category=Bags, product=Aromantic Scent, Quantity=50pcs    → BAG-AROMSCT-50PCS
//   category=Women Bags, product=Shoe X, Color=Red, Size=35   → WB-SHOEX-RED-35

export interface SkuInput {
  categoryName: string;
  productName: string;
  /** Pass options in display order; both name and value are used for uniqueness disambiguation */
  options: Array<{ optionName: string; valueName: string }>;
}

// Strips everything except alphanumerics, uppercases
function clean(text: string): string {
  return text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Multi-word text → first letter of each word (e.g. "Women Bags" → "WB")
// Single word     → first `maxLen` chars         (e.g. "Bags"       → "BAG")
function abbreviateCategory(name: string, maxLen: number): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return clean(words[0]).slice(0, maxLen);
  return words.map((w) => clean(w)[0] ?? '').join('').slice(0, maxLen);
}

// For product name: collapse all words into one alphanumeric string, then limit.
// Preserves numbers inline (e.g. "BFLO 226" → "BFLO226", "Aromantic Scent" → "AROMSCT")
function abbreviateProduct(name: string, maxLen: number): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 1) return clean(words[0]).slice(0, maxLen);

  // Try full concatenation first; if it fits, use it
  const full = words.map((w) => clean(w)).join('');
  if (full.length <= maxLen) return full;

  // Otherwise take the first word in full + first letter(s) of the rest
  const firstWord = clean(words[0]);
  const remaining = words.slice(1).map((w) => clean(w));
  const budget = maxLen - firstWord.length;

  if (budget <= 0) return firstWord.slice(0, maxLen);

  // Fill remaining budget with chars from subsequent words
  let suffix = '';
  for (const w of remaining) {
    if (suffix.length >= budget) break;
    suffix += w.slice(0, Math.max(1, budget - suffix.length));
  }

  return (firstWord + suffix).slice(0, maxLen);
}

// Option value: strip non-alphanumeric, uppercase, limit length
// "Black" → "BLACK", "50pcs" → "50PCS", "3pcs" → "3PCS", "Large" → "LARGE"
function abbreviateValue(value: string, maxLen: number): string {
  return clean(value).slice(0, maxLen);
}

export function generateSku({ categoryName, productName, options }: SkuInput): string {
  const cat = abbreviateCategory(categoryName, 3);   // max 3 chars
  const prod = abbreviateProduct(productName, 8);    // max 8 chars
  const vals = options.map(({ valueName }) => abbreviateValue(valueName, 6)); // max 6 chars each

  return [cat, prod, ...vals].filter(Boolean).join('-');
}
