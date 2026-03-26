/**
 * @fileOverview High-efficiency NLU Stub.
 * Replaces the heavy linguistic engine to reduce bundle weight.
 */

export interface NLUResult {
  cleanedText: string;
  language: string;
  hasNumbers: boolean;
  hasMath: boolean;
  firstNumber: number | null;
  quantity: number | null;
  unit: string | null;
  numbers: any[];
}

export type Intent =
  | { type: 'NAVIGATE'; destination: string; originalText: string; lang: string }
  | { type: 'CONVERSATIONAL'; commandKey: string; originalText: string; lang: string }
  | { type: 'ORDER_ITEM'; originalText: string; lang: string }
  | { type: 'UNKNOWN'; originalText: string; lang: string };

/**
 * Performs basic string cleaning without heavy dictionaries.
 */
export function runNLU(text: string, lang: string = "en"): NLUResult {
  const cleaned = (text || "").trim();
  return {
    cleanedText: cleaned,
    language: lang,
    hasNumbers: false,
    hasMath: false,
    firstNumber: null,
    quantity: null,
    unit: null,
    numbers: [],
  };
}

/**
 * Pass-through extractor for basic item matching.
 */
export function extractQuantityAndProduct(nlu: NLUResult) {
    return {
        qty: 1,
        unit: null,
        money: null,
        productPhrase: nlu.cleanedText,
    };
}

/**
 * Simple keyword-based intent recognition.
 */
export function recognizeIntent(text: string, lang: string): Intent {
    const lower = (text || "").toLowerCase().trim();
    if (['order', 'buy', 'add', 'get'].some(kw => lower.includes(kw))) {
        return { type: 'ORDER_ITEM', originalText: text, lang };
    }
    return { type: 'UNKNOWN', originalText: text, lang };
}
