'use client';
import { parseNumbers } from './number-engine-v2';
import { parseRefsFromText } from './ref-parser';
import { chooseVariantFromPriceList } from './ref-resolver';
import type { Product, ProductVariant } from '@/lib/types';

function detectProductName(products: Product[], text: string): Product | null {
  for (const p of products) {
    if (text.includes(p.name.toLowerCase())) return p;
  }
  return null;
}

export async function processVoiceCommand(commandText: string, ctx: any) {
  const text = commandText.toLowerCase().trim();
  const { products, variants, addItem, speak, showConfirm, lastIndexRef } = ctx;

  // 1) Number parsing
  const nums = parseNumbers(text);
  const qty = nums.find(n => n.unit === undefined)?.normalizedValue || 1;

  // 2) Reference parsing (first, second, last, cheapest, big…)
  const refParsed = parseRefsFromText(text, ctx.lang || 'en', variants?.length || 0);

  // 3) If explicit product search phrase
  const productName = detectProductName(products, text);
  if (productName) {
    if (!variants || variants.length === 0) {
      speak("No variants found");
      return;
    }

    // If reference ie. "add the second one"
    const pick = chooseVariantFromPriceList(variants, text, ctx.lang || 'en');

    if (pick.chosen) {
      addItem(productName, pick.chosen, qty);
      if (pick.chosenIndex !== null) {
          lastIndexRef.current = pick.chosenIndex;
      }
      speak("Added to cart");
      return;
    }

    // fallback ask confirmation
    showConfirm(variants);
    return;
  }

  // 4) If user said only "first one / second one / 1kg one / 40 rupees one"
  if (variants && variants.length > 0) {
    const pick = chooseVariantFromPriceList(variants, text, ctx.lang || 'en');
    if (pick.chosen) {
      addItem(null, pick.chosen, qty);
      if (pick.chosenIndex !== null) {
        lastIndexRef.current = pick.chosenIndex;
      }
      speak("Added");
      return;
    }
  }

  speak("Sorry, I didn't understand");
}
