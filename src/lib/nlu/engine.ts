
/**
 * @fileOverview Stubbed NLU Engine to resolve build failures.
 * This file replaces the complex linguistic analysis with simple pass-through logic.
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

export function runNLU(text: string, lang: string = "en"): NLUResult {
  return {
    cleanedText: text.trim(),
    language: lang,
    hasNumbers: false,
    hasMath: false,
    firstNumber: null,
    quantity: null,
    unit: null,
    numbers: [],
  };
}

export function extractQuantityAndProduct(nlu: NLUResult) {
    return {
        qty: 1,
        unit: null,
        money: null,
        productPhrase: nlu.cleanedText,
    };
}

export function recognizeIntent(text: string, lang: string): Intent {
    const lower = text.toLowerCase().trim();
    if (lower.includes('order') || lower.includes('buy') || lower.includes('add')) {
        return { type: 'ORDER_ITEM', originalText: text, lang };
    }
    return { type: 'UNKNOWN', originalText: text, lang };
}
