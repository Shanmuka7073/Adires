
'use client';
import { parseRefsFromText } from './ref-parser';
import { resolveRefData, type RefResolverResult } from './ref-resolver';

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
 * Main NLU entry point used by VoiceCommander.
 * Takes raw voice text → returns complete NLU analysis.
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

  const first = resolved.numbers[0] || null;

  return {
    ...resolved,
    cleanedText,
    language: lang,
    hasNumbers: resolved.numbers.length > 0,
    hasMath: resolved.mathExpression !== null,
    firstNumber: first?.value ?? null,
    quantity: first?.type === 'quantity' || first?.unit ? first?.value ?? null : null,
    unit: first?.unit ?? null,
  };
}

/**
 * Utility used by VoiceCommander to quickly extract quantity + product phrase.
 */
export function extractQuantityAndProduct(nlu: NLUResult) {
  let qty = 1;
  let unit: string | null = null;
  let money: number | null = null;

  const text = nlu.cleanedText.toLowerCase();

  // 1. If NLU found quantity → use it
  if (nlu.quantity) qty = nlu.quantity;
  if (nlu.unit) unit = nlu.unit;

  // 2. Detect money ₹, rs, rupees
  const moneyMatch = text.match(/(?:rs\.?|₹|rupees?|రూపాయల|रुपय|rupay)\s*([\d.]+)/);
  if (moneyMatch) {
    money = parseFloat(moneyMatch[1]);
  }

  // 3. Detect explicit weight (500gm, 250g, 1kg etc)
  let weightMatch = text.match(/(\d+)\s*(kg|kilo|g|gm|grams|ml|ltr|liter|litre)/);
  if (weightMatch) {
    qty = parseFloat(weightMatch[1]);
    unit = weightMatch[2];

    // Normalize units
    if (unit.startsWith("g")) unit = "gm";
    if (unit.startsWith("k")) unit = "kg";
    if (unit.startsWith("l")) unit = "ltr";
  }

  // 4. Fraction words
  const fractionWords: Record<string, number> = {
    "half": 0.5,
    "1/2": 0.5,
    "one half": 0.5,
    "quarter": 0.25,
    "1/4": 0.25,
    "three fourth": 0.75,
    "three quarters": 0.75,
    "3/4": 0.75,
    "సగం": 0.5,
    "అర": 0.5,
    "పావు": 0.25,
    "మూడొంతులు": 0.75,
    "आधा": 0.5,
    "पाव": 0.25,
    "तीन चौथाई": 0.75
  };

  for (const key in fractionWords) {
    if (text.includes(key)) {
      qty = fractionWords[key];
      if (!unit) unit = "kg";  // default human assumption
    }
  }

  // 5. Money-based quantity
  // qty = money / pricePerKg → handled later in VoiceCommander
  // we only pass money forward
  const remainder = text
    .replace(/(\d+)\s*(kg|gm|g|ml|ltr|pack|piece|pieces)/, "")
    .replace(/half|quarter|three fourth|three quarters|1\/2|1\/4|3\/4/g, "")
    .replace(/rs\.?|₹|rupees?|rupay|రూపాయల|रुपय/g, "")
    .trim();

  return {
    qty,
    unit,
    money,
    productPhrase: remainder
  };
}

