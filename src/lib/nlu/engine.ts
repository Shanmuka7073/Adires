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
  const first = numberResult.numbers[0] || null;

  return {
    numbers: numberResult.numbers,
    cleanedText: numberResult.cleanedText,
    language: lang,
    hasNumbers: numberResult.numbers.length > 0,
    hasMath: numberResult.mathResult !== null,
    firstNumber: first?.value ?? null,
    quantity: first?.type === "quantity" || first?.type === 'fraction' ? first?.value ?? null : (first?.type === "number" ? first.value : null),
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

  // strip leading action / filler words
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
    
    const numberData = nlu.numbers.length > 0 ? nlu.numbers[0] : null;

    // 1. Check for MONEY context
    const moneyRegex = /(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయలు)\.?/i;
    if (text.match(moneyRegex) && numberData) {
        money = numberData.value;
        qty = 1; 
        unit = null;
    } else if (numberData) {
        // 2. Handle QUANTITY context
        qty = numberData.value;
        unit = numberData.unit || null;
    }
    
    // 3. Remove number/unit/money phrases from text
    let phraseForCleanup = text;
    
    // Remove money keywords
    phraseForCleanup = phraseForCleanup.toLowerCase().replace(moneyRegex, '').trim();

    // Remove raw number/unit/quantity phrases
    if (numberData) {
        // Strip the raw number text (e.g., '1kg', 'two hundred fifty', '30')
        phraseForCleanup = phraseForCleanup.replace(new RegExp(`\\b${numberData.raw}\\b`, 'i'), '').trim();
    }
    
    // 4. Final cleanup for action/filler words
    let productPhrase = cleanProductPhrase(phraseForCleanup, nlu.language);

    // Final check for common quantity/unit words that cleanProductPhrase missed
    productPhrase = productPhrase.replace(/\b(kilo|gram(s|ula)?|pettu|daal|do)\b/g, '').trim();
    
    return { qty, unit, money, productPhrase };
}


/**
 * RECOGNIZE INTENT
 */
export function recognizeIntent(text: string, lang: string): Intent {
    const lower = text.toLowerCase().trim();
  
    // 1) SMART ORDER: "order X from Y to Z"
    if ((lower.includes('order') || lower.includes('send')) && lower.includes('from') && lower.includes('to')) {
        return { type: 'SMART_ORDER', originalText: text, lang };
    }
  
    // 2) CHECK PRICE
    if (
        lower.includes('price of') ||
        lower.includes('cost of') ||
        lower.includes('cost ') ||
        lower.includes('dhara entha') ||          // te
        lower.includes('daam kya hai')            // hi
    ) {
        const cleaned = lower
            .replace('price of', '')
            .replace('cost of', '')
            .replace('cost', '')
            .replace('dhara entha', '')
            .replace('daam kya hai', '')
            .trim();

        return {
            type: 'CHECK_PRICE',
            productPhrase: cleanProductPhrase(cleaned, lang),
            originalText: text,
            lang,
        };
    }

    // 3) REMOVE FROM CART
    if (lower.startsWith('remove') || lower.includes('teeseyi') || lower.includes('nikal') || lower.includes('hata')) {
        const cleaned = lower
            .replace(/^remove\s+/, '')
            .replace(/teeseyi|nikal|hata/g, '') // strip common words if they appear elsewhere
            .trim();

        return {
            type: 'REMOVE_ITEM',
            productPhrase: cleanProductPhrase(cleaned, lang),
            originalText: text,
            lang,
        };
    }
  
    // 4) NAVIGATE – orders / cart
    if (
        lower.includes('go to my orders') ||
        lower.includes('na orderlaku vellu') ||
        lower.includes('mere orders par jao')
    ) {
        return {
            type: 'NAVIGATE',
            destination: 'orders',
            originalText: text,
            lang,
        };
    }
  
    if (
        lower.includes('open cart') ||
        lower.includes('cart open cheyi')
    ) {
        return {
            type: 'NAVIGATE',
            destination: 'cart',
            originalText: text,
            lang,
        };
    }
  
    // 5) CONVERSATIONAL "help"
    if (
        lower.startsWith('help') ||
        lower.includes('sahayam cheyi') ||
        lower.includes('madad')
    ) {
        return {
            type: 'CONVERSATIONAL',
            commandKey: 'help',
            originalText: text,
            lang,
        };
    }
  
    // 6) ORDER ITEM (fallback if we see quantity/product)
    const nlu = runNLU(text, lang);
    if (nlu.hasNumbers || text.match(/(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయలు)/i)) {
      return { type: 'ORDER_ITEM', originalText: text, lang };
    }
  
    // 7) default
    return { type: 'UNKNOWN', originalText: text, lang };
}
