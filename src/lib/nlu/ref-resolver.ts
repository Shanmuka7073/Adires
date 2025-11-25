// Utilities to take parse output and pick items from arrays (variants/products)
import { parseRefsFromText, resolveParsedRefs } from './ref-parser';

export function chooseByPosition<T>(items: T[], parsedRefs: ReturnType<typeof parseRefsFromText>) : { chosen: T|null; chosenIndex: number|null } {
  if (!items || items.length === 0) return { chosen: null, chosenIndex: null };
  const resolved = resolveParsedRefs(parsedRefs, items.length);
  if (resolved.resolvedPositions && resolved.resolvedPositions.length > 0) {
    const idx = resolved.resolvedPositions[0];
    const safeIdx = Math.max(0, Math.min(items.length - 1, idx));
    return { chosen: items[safeIdx], chosenIndex: safeIdx };
  }
  // fallback: if deictic THIS or THAT, pick first/last
  if (resolved.deictic) {
    if (resolved.deictic.value === 'THIS') return { chosen: items[0], chosenIndex: 0 };
    if (resolved.deictic.value === 'THAT') return { chosen: items[items.length - 1], chosenIndex: items.length - 1 };
  }
  // fallback: if attribute 'CHEAP' or 'EXPENSIVE' ask to sort by price if present
  const attrs = resolved.attributes.map(a => a.key);
  if (attrs.includes('CHEAP') && (items as any[])[0] && (items as any[])[0].price !== undefined) {
    const sorted = [...(items as any[])].sort((a,b) => a.price - b.price);
    return { chosen: sorted[0] as T, chosenIndex: (items as any[]).indexOf(sorted[0]) };
  }
  if (attrs.includes('EXPENSIVE') && (items as any[])[0] && (items as any[])[0].price !== undefined) {
    const sorted = [...(items as any[])].sort((a,b) => b.price - a.price);
    return { chosen: sorted[0] as T, chosenIndex: (items as any[]).indexOf(sorted[0]) };
  }

  // default: choose first
  return { chosen: items[0], chosenIndex: 0 };
}

export function chooseVariantFromPriceList(variants: any[], phrase: string, lang: 'en'|'te'|'hi' = 'en') {
  const parsed = parseRefsFromText(phrase, lang, variants.length);
  // If phrase contains explicit number (1kg / 500g / ₹ 50) let number engine decide — here fallback by position
  const pick = chooseByPosition(variants, parsed);
  return pick;
}
