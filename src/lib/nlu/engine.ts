
// IMPORTANT: This file contains pure, environment-agnostic logic and should NOT have a 'use client' directive.

import { parseRefsFromText } from './ref-parser';
import { resolveRefData, type RefResolverResult } from './ref-resolver';
import { parseNumbers } from './number-engine-v2';

export interface NLUResult extends RefResolverResult {
  cleanedText: string;
  language: string;
  hasNumbers: boolean;
  hasMath: boolean;
  firstNumber: number | null;
  quantity: number | null;
  unit: string | null;
}

/**
 * MAIN NLU ENTRY
 */
export function runNLU(text: string, lang: string = 'en'): NLUResult {
  if (!text || typeof text !== 'string') {
    return {
      original: '',
      tokens: [],
      numbers: [],
      mathExpression: null,
      mathResult: null,
      intentHints: [],
      cleanedText: '',
      language: lang,
      hasNumbers: false,
      hasMath: false,
      firstNumber: null,
      quantity: null,
      unit: null,
    };
  }

  const cleanedText = text
    .trim()
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ');

  const refs = parseRefsFromText(cleanedText);
  const resolved = resolveRefData(cleanedText, refs);

  const numParsed = parseNumbers(cleanedText);
  const allNumbers = [...resolved.numbers, ...numParsed];

  const first = allNumbers[0] || null;

  return {
    ...resolved,
    numbers: allNumbers,
    cleanedText,
    language: lang,
    hasNumbers: allNumbers.length > 0,
    hasMath: resolved.mathExpression !== null,
    firstNumber: first?.value ?? null,
    quantity: first?.type === 'quantity' ? first?.value ?? null : null,
    unit: first?.unit ?? null,
  };
}

/**
 * EXTRACT QUANTITY + PRODUCT PHRASE
 */
export function extractQuantityAndProduct(nlu: NLUResult) {
  let qty = 1;
  let unit: string | null = null;
  let money: number | null = null;

  let text = nlu.cleanedText.toLowerCase();

  // STRICT full-word money regex
  const moneyRegex =
    /\b(?:₹|rs|rupees|rupay|rupaya|रुपये|రూపాయల)\b\.?\s*(\d+\.?\d*)|\b(\d+\.?\d*)\s*(?:₹|rs|rupees|rupay|रुपये|రూపాయల)\b/i;

  // STRICT full-word weight regex
  const weightRegex =
    /\b(\d+\.?\d*)\s*\b(kg|kilo|kilogram|grams|gram|gm|g|gms)\b/i;

  // STRICT full-word volume regex
  const volumeRegex =
    /\b(\d+\.?\d*)\s*\b(liter|litre|ltr|liters|litres|ml|milliliter|millilitre)\b/i;

  // STRICT piece regex
  const pieceRegex = /\b(\d+)\s*\b(pack|packet|piece|pieces|pc)\b/i;

  // STRICT fraction words
  const fractionWords: Record<string, number> = {
    "half": 0.5,
    "1/2": 0.5,
    "one half": 0.5,
    "quarter": 0.25,
    "one quarter": 0.25,
    "1/4": 0.25,
    "three fourths": 0.75,
    "three quarters": 0.75,
    "3/4": 0.75,

    // Telugu
    "సగం": 0.5,
    "అర": 0.5,
    "పావు": 0.25,
    "మూడొంతులు": 0.75,

    // Hindi
    "आधा": 0.5,
    "पाव": 0.25,
    "तीन चौथाई": 0.75
  };

  let match;

  // 1) MONEY
  if ((match = text.match(moneyRegex))) {
    money = parseFloat(match[1] || match[2]);
    text = text.replace(match[0], "").trim();
  }

  // 2) WEIGHT
  else if ((match = text.match(weightRegex))) {
    qty = parseFloat(match[1]);
    unit = match[2].startsWith("k") ? "kg" : "gm";
    text = text.replace(match[0], "").trim();
  }

  // 3) VOLUME (fixed: no conflicts)
  else if ((match = text.match(volumeRegex))) {
    qty = parseFloat(match[1]);

    const u = match[2];
    if (u.startsWith("l")) unit = "ltr";   // liter family
    else unit = "ml";                      // ml family

    text = text.replace(match[0], "").trim();
  }

  // 4) PIECES
  else if ((match = text.match(pieceRegex))) {
    qty = parseInt(match[1], 10);
    unit = "pc";
    text = text.replace(match[0], "").trim();
  }

  // 5) FRACTIONS (kg/ltr auto detection)
  else {
    for (const key in fractionWords) {
      if (text.includes(key)) {
        qty = fractionWords[key];

        // check if next word is liter
        if (/\b(liter|litre|ltr)\b/.test(text)) unit = "ltr";
        else unit = "kg"; // default only if weight product

        text = text.replace(key, "").trim();
        break;
      }
    }
  }

  // 6) CLEANUP — remove true standalone units only
  text = text.replace(
    /\b(kg|g|gm|grams|ml|ltr|liter|litre|packet|pack|piece|pieces|pc)\b/gi,
    ""
  );

  const productPhrase = text.trim();

  return { qty, unit, money, productPhrase };
}
