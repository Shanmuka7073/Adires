
// IMPORTANT: Pure logic file (NO use client)

import { parseRefsFromText } from "./ref-parser";
import { resolveRefData, type RefResolverResult } from "./ref-resolver";
import { parseNumbers } from "./number-engine-v2";

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
export function runNLU(text: string, lang: string = "en"): NLUResult {
  if (!text || typeof text !== "string") {
    return {
      original: "",
      tokens: [],
      numbers: [],
      mathExpression: null,
      mathResult: null,
      intentHints: [],
      cleanedText: "",
      language: lang,
      hasNumbers: false,
      hasMath: false,
      firstNumber: null,
      quantity: null,
      unit: null,
    };
  }

  const cleanedText = text.trim().replace(/\u00A0/g, " ").replace(/\s+/g, " ");

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
    quantity: first?.type === "quantity" ? first?.value ?? null : null,
    unit: first?.unit ?? null,
  };
}

/**
 * EXTRACT QUANTITY + PRODUCT
 */
export function extractQuantityAndProduct(nlu: NLUResult) {
  let qty = 1;
  let unit: string | null = null;
  let money: number | null = null;

  let text = nlu.cleanedText.toLowerCase();

  // FULL WORD ONLY (no partial matches)
  const moneyRegex =
    /\b(₹|rs|rupees|rupay|rupaya|रूपये|రూపాయల)\b\.?\s*(\d+\.?\d*)|\b(\d+\.?\d*)\s*\b(₹|rs|rupees|रूपये|రూపాయల)\b/i;

  const weightRegex =
    /\b(\d+\.?\d*)\s*\b(kg|kilo|kilogram|kilograms|gram|grams|gm|g|gms)\b/i;

  const volumeRegex =
    /\b(\d+\.?\d*)\s*\b(liter|litre|liters|litres|ltr|l|ml|milliliter|millilitre)\b/i;

  const pieceRegex = /\b(\d+)\s*\b(pack|packet|pc|piece|pieces)\b/i;

  const fractionWords: Record<string, number> = {
    "one and half": 1.5,
    "one and a half": 1.5,
    "half": 0.5,
    "1/2": 0.5,
    "one half": 0.5,
    "quarter": 0.25,
    "1/4": 0.25,
    "one quarter": 0.25,
    "three fourths": 0.75,
    "three quarters": 0.75,
    "3/4": 0.75,

    // Telugu
    "ఒకటిన్నర": 1.5,
    "సగం": 0.5,
    "అర": 0.5,
    "పావు": 0.25,
    "మూడొంతులు": 0.75,

    // Hindi
    "डेढ़": 1.5,
    "आधा": 0.5,
    "पाव": 0.25,
    "तीन चौथाई": 0.75,
  };

  let match;

  // -----------------------
  // 1) MONEY
  // -----------------------
  if ((match = text.match(moneyRegex))) {
    const val = match[2] || match[3];
    if (val) money = parseFloat(val);
    text = text.replace(match[0], "").trim();
  }

  // -----------------------
  // 2) WEIGHT
  // -----------------------
  else if ((match = text.match(weightRegex))) {
    qty = parseFloat(match[1]);
    const u = match[2].toLowerCase();
    unit = u.startsWith("k") ? "kg" : "gm";
    text = text.replace(match[0], "").trim();
  }

  // -----------------------
  // 3) VOLUME (STRICT)
  // -----------------------
  else if ((match = text.match(volumeRegex))) {
    qty = parseFloat(match[1]);
    const u = match[2].toLowerCase();

    if (u.startsWith("l")) unit = "ltr";
    else unit = "ml";

    text = text.replace(match[0], "").trim();
  }

  // -----------------------
  // 4) PIECES
  // -----------------------
  else if ((match = text.match(pieceRegex))) {
    qty = parseInt(match[1], 10);
    unit = "pc";
    text = text.replace(match[0], "").trim();
  }

  // -----------------------
  // 5) FRACTIONS (smart)
  // -----------------------
  else {
    for (const key in fractionWords) {
      if (text.includes(key)) {
        qty = fractionWords[key];

        // Weight or volume?
        if (/\b(liter|litre|ltr|liters|litres)\b/.test(text)) {
          unit = "ltr";
        } else if (/\b(ml|milliliter|millilitre)\b/.test(text)) {
          unit = "ml";
        } else {
          // Default only if weight-like product
          unit = "kg";
        }

        text = text.replace(key, "").trim();
        break;
      }
    }
  }

  // -----------------------
  // 6) CLEANUP (standalone units only)
  // -----------------------
  text = text.replace(
    /\b(kg|kilo|g|gm|grams|liter|litre|ltr|l|ml|pack|packet|piece|pieces|pc)\b/gi,
    ""
  );

  const productPhrase = text.trim();

  return {
    qty,
    unit,
    money,
    productPhrase,
  };
}
