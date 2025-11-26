
'use client';

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

  // 1. If NLU found quantity → use it
  if (nlu.quantity !== null) qty = nlu.quantity;
  if (nlu.unit) unit = nlu.unit;

  // 2. Detect MONEY → rupees, rs, ₹, rupay, రూపాయల, रुपय
  const moneyRegex =
    /(₹\s*\d+\.?\d*)|(\d+\.?\d*\s*rs)|(\d+\.?\d*\s*rs\.)|(\d+\.?\d*\s*rupees?)|(\d+\.?\d*\s*rupay)|(\d+\s*रुपय)|(\d+\s*రూపాయల)/;

  const match = text.match(moneyRegex);
  if (match) {
    const extractedNumber = match[0].replace(/[^\d.]/g, "");
    money = parseFloat(extractedNumber);
    text = text.replace(match[0], '').trim(); // Remove money part from text
  }

  // 3. Detect explicit weight expressions (e.g., 250kg, 250 kg, kg250)
  const unitWords = ['kg', 'kilo', 'g', 'gm', 'grams', 'ml', 'ltr', 'liter', 'litre'];
  const weightRegex = new RegExp(`(?:(\\d+\\.?\\d*)\\s*(${unitWords.join('|')}))|(?:(${unitWords.join('|')})\\s*(\\d+\\.?\\d*))`, 'i');
  let weightMatch = text.match(weightRegex);

  if (weightMatch) {
    qty = parseFloat(weightMatch[1] || weightMatch[4]);
    unit = (weightMatch[2] || weightMatch[3]).toLowerCase();

    // Normalize
    if (unit.startsWith("g")) unit = "gm";
    if (unit.startsWith("k")) unit = "kg";
    if (unit.startsWith("l")) unit = "ltr";

    text = text.replace(weightMatch[0], '').trim();
  }

  // 4. Fractions & word fractions
  const fractionWords: Record<string, number> = {
    "half": 0.5, "1/2": 0.5, "one half": 0.5,
    "quarter": 0.25, "1/4": 0.25,
    "three fourth": 0.75, "three quarters": 0.75, "3/4": 0.75,
    "సగం": 0.5, "అర": 0.5, "పావు": 0.25, "మూడొంతులు": 0.75,
    "आधा": 0.5, "पाव": 0.25, "तीन चौथाई": 0.75
  };

  for (const k in fractionWords) {
    if (text.includes(k)) {
      qty = fractionWords[k];
      if (!unit) unit = "kg"; // default
      text = text.replace(k, '').trim();
    }
  }

  // 5. Remove any remaining number/unit parts to isolate the product phrase
  const remainder = text
    .replace(/(\d+)\s*(kg|gm|g|ml|ltr|pack|piece|pieces)/, "")
    .replace(/half|quarter|three fourth|three quarters|1\/2|1\/4|3\/4/gi, "")
    .trim();

  return {
    qty,
    unit,
    money,
    productPhrase: remainder
  };
}
