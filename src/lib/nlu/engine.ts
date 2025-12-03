// IMPORTANT: Pure logic file (NO use client)

import { extractNumbers, type ParsedNumber } from "./number-engine-v2";

export interface NLUResult {
  cleanedText: string;
  language: string;
  hasNumbers: boolean;
  hasMath: boolean;
  firstNumber: number | null;
  quantity: number | null;
  unit: string | null;
  numbers: ParsedNumber[];
}

export type Intent =
  | { type: 'SMART_ORDER'; originalText: string; lang: string }
  | { type: 'CHECK_PRICE'; productPhrase: string; originalText: string; lang: string }
  | { type: 'ORDER_ITEM'; originalText: string; lang: string }
  | { type: 'REMOVE_ITEM'; productPhrase: string; originalText: string; lang: string }
  | { type: 'NAVIGATE'; destination: string; originalText: string; lang: string }
  | { type: 'CONVERSATIONAL'; commandKey: string; originalText: string; lang: string }
  | { type: 'GET_RECIPE'; dishName: string; originalText: string; lang: string }
  | { type: 'SHOW_DETAILS'; target: string; originalText: string; lang: string }
  | { type: 'GET_KNOWLEDGE'; topic: string; originalText: string; lang: string }
  | { type: 'MATH'; originalText: string; lang: string }
  | { type: 'UNKNOWN'; originalText: string; lang: string };

/**
 * MAIN NLU ENTRY
 */
export function runNLU(text: string, lang: string = "en"): NLUResult {
  if (!text || typeof text !== "string") {
    return {
      cleanedText: "",
      language: lang,
      hasNumbers: false,
      hasMath: false,
      firstNumber: null,
      quantity: null,
      unit: null,
      numbers: [],
    };
  }

  const cleanedText = text.trim().replace(/\u00A0/g, " ").replace(/\s+/g, " ");
  const numberResult = extractNumbers(cleanedText);
  const first = numberResult[0] || null;

  return {
    numbers: numberResult,
    cleanedText: cleanedText,
    language: lang,
    hasNumbers: numberResult.length > 0,
    hasMath: false, 
    firstNumber: first?.value ?? null,
    quantity: first?.value ?? null,
    unit: first?.unit ?? null,
  };
}

const ACTION_WORDS: Record<string, string[]> = {
  en: ['add', 'order', 'buy', 'get', 'send', 'cost', 'price', 'remove', 'go', 'open', 'help'],
  te: ['pettu', 'teeseyi', 'vellu', 'cheyi', 'dhara', 'entha'],
  hi: ['daal', 'nikal', 'hata', 'madad', 'jao', 'kholo', 'daam', 'kya', 'hai'],
};

const FILLER_WORDS = [
  'of', 'from', 'my', 'to', 'the', 'par', 'se', 'nundi', 'ka', 'ki', 'ko', 'lo', 'la'
];

function cleanProductPhrase(raw: string, lang: string): string {
  const lowerTokens = raw.trim().toLowerCase().split(/\s+/);
  const actionSet = new Set(ACTION_WORDS[lang] ?? []);
  const fillerSet = new Set(FILLER_WORDS);

  while (lowerTokens.length && (actionSet.has(lowerTokens[0]) || fillerSet.has(lowerTokens[0]))) {
    lowerTokens.shift();
  }

  return lowerTokens.join(' ').trim();
}

/**
 * EXTRACT QUANTITY + PRODUCT PHRASE
 */
export function extractQuantityAndProduct(nlu: NLUResult) {
  let text = nlu.cleanedText;
  let qty = 1;
  let unit: string | null = null;
  let money: number | null = null;
  let productPhrase = text;

  const numberData = nlu.numbers.length > 0 ? nlu.numbers[0] : null;

  const moneyRegex = /(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయలు)\.?/i;
  const moneyMatch = text.match(moneyRegex);

  if (moneyMatch && numberData) {
    money = numberData.value;
    productPhrase = text.substring(0, moneyMatch.index!).trim() + text.substring(moneyMatch.index! + moneyMatch[0].length).trim();
    productPhrase = productPhrase.replace(numberData.raw, '').trim();
    qty = 1;
    unit = null;
  } else if (numberData) {
    qty = numberData.value;
    unit = numberData.unit || null;
    productPhrase = (text.substring(0, numberData.span[0]) + text.substring(numberData.span[1])).trim();
    
    // Also remove the unit if it was a separate word
    if (unit) {
        const unitRegex = new RegExp(`\\s+${Object.keys(nlu.numbers[0].unit!).find(u => u.toLowerCase() === unit)}s?\\b`, 'i');
        productPhrase = productPhrase.replace(unitRegex, '').trim();
    }
  }

  // Final cleanup for action words
  productPhrase = cleanProductPhrase(productPhrase, nlu.language);

  return { qty, unit, money, productPhrase };
}


/**
 * RECOGNIZE INTENT
 */
export function recognizeIntent(text: string, lang: string): Intent {
    const lower = text.toLowerCase().trim();
  
    if (lower.includes('order') && lower.includes('from') && lower.includes('to')) {
        return { type: 'SMART_ORDER', originalText: text, lang };
    }
  
    if (lower.includes('price of') || lower.includes('cost of') || lower.includes('dhara entha') || lower.includes('daam kya hai')) {
        const productPhrase = lower.replace(/price of|cost of|dhara entha|daam kya hai/g, '').trim();
        return { type: 'CHECK_PRICE', productPhrase: cleanProductPhrase(productPhrase, lang), originalText: text, lang };
    }
  
    if (lower.startsWith('remove') || lower.includes('teeseyi') || lower.includes('nikal')) {
        const productPhrase = lower.replace(/remove/g, '').trim();
        return { type: 'REMOVE_ITEM', productPhrase: cleanProductPhrase(productPhrase, lang), originalText: text, lang };
    }
  
    if (lower.includes('go to my orders') || lower.includes('na orderlaku vellu') || lower.includes('mere orders par jao')) {
        return { type: 'NAVIGATE', destination: 'orders', originalText: text, lang };
    }
  
    if (lower.includes('open cart') || lower.includes('cart open cheyi')) {
        return { type: 'NAVIGATE', destination: 'cart', originalText: text, lang };
    }
  
    if (lower.startsWith('help') || lower.includes('sahayam cheyi') || lower.includes('madad')) {
        return { type: 'CONVERSATIONAL', commandKey: 'help', originalText: text, lang };
    }
  
    const nlu = runNLU(text, lang);
    if (nlu.hasNumbers || text.match(/(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయలు)/i)) {
      return { type: 'ORDER_ITEM', originalText: text, lang };
    }
  
    return { type: 'UNKNOWN', originalText: text, lang };
}
