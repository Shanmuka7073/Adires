
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
    hasMath: false, // Math is not part of this engine version yet
    firstNumber: first?.value ?? null,
    quantity: first?.type === 'quantity' || first?.type === 'fraction' ? first.value : (first?.type === 'number' ? first.value : null),
    unit: first?.unit ?? null,
  };
}

// Words we want to strip from the *front* of the phrase
const ACTION_WORDS: Record<string, string[]> = {
  en: ['add', 'order', 'buy', 'get', 'send', 'cost', 'price', 'remove', 'go', 'open', 'help'],
  te: ['pettu', 'teeseyi', 'vellu', 'cheyi', 'dhara', 'entha'],
  hi: ['daal', 'nikal', 'hata', 'madad', 'jao', 'kholo', 'daam', 'kya', 'hai'],
};

// Filler words that often appear before the actual product
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
  let qty = 1; // Default quantity
  let unit: string | null = null;
  let money: number | null = null;
  let text = nlu.cleanedText;

  // Use the parsed numbers from the NLU result
  const parsedNumbers = nlu.numbers;
  let phraseWithoutNumbers = text;

  if (parsedNumbers.length > 0) {
    const firstNum = parsedNumbers[0];
    qty = firstNum.value;
    unit = firstNum.unit || null;
    
    // Create a phrase with the number part blanked out to avoid re-matching
    phraseWithoutNumbers = text.substring(0, firstNum.span[0]) + ' '.repeat(firstNum.raw.length) + text.substring(firstNum.span[1]);
  }
  
  // Regex for money detection (now including Telugu and Hindi words)
  const moneyRegex = /(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయలు)\.?\s*(\d+\.?\d*)|(\d+\.?\d*)\s*(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయలు)\.?/i;
  let match;

  if ((match = text.match(moneyRegex))) {
    // If a money term is found, it overrides the quantity.
    money = parseFloat(match[1] || match[2]);
    qty = 1; // Reset quantity if it's a monetary value
    unit = null; // Money implies no unit like kg/gm
    phraseWithoutNumbers = text.replace(match[0], "").trim();
  }
  
  // Final cleanup of the remaining phrase
  let productPhrase = cleanProductPhrase(phraseWithoutNumbers, nlu.language);

  // If a unit was found but no quantity number, it implies a quantity of 1
  const unitWords = ['kg', 'kilo', 'gram', 'gm', 'litre', 'pack', 'pc'];
  const firstWord = productPhrase.split(' ')[0];
  if(unitWords.includes(firstWord) && parsedNumbers.length === 0 && !money) {
      productPhrase = productPhrase.replace(firstWord, '').trim();
  }

  return {
    qty,
    unit,
    money,
    productPhrase,
  };
}


/**
 * RECOGNIZE INTENT
 */
export function recognizeIntent(text: string, lang: string): Intent {
    const lower = text.toLowerCase().trim();
  
    // 1) SMART ORDER: "order X from Y to Z"
    if (
      /^order\s/.test(lower) &&
      /\sfrom\s.+\sto\s.+/.test(lower)
    ) {
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
    if (
      /^remove\s/.test(lower) ||
      lower.startsWith('na cart nundi') ||   // te
      lower.includes('teeseyi') ||          // te
      lower.includes('nikal') ||            // hi
      lower.includes('hata')                // hi
    ) {
      const cleaned = lower
        .replace(/^remove\s+/, '')
        .replace(/^na cart nundi\s+/, '')
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
      lower.includes('madad') // if you add such Hindi phrases later
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
    if (nlu.hasNumbers) {
      return { type: 'ORDER_ITEM', originalText: text, lang };
    }
    const moneyRegex = /(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయలు)/i;
    if (moneyRegex.test(lower)) {
        return { type: 'ORDER_ITEM', originalText: text, lang };
    }
  
    // 7) default
    return { type: 'UNKNOWN', originalText: text, lang };
}
