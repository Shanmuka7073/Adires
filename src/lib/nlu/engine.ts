
// IMPORTANT: Pure logic file (NO use client)

import { extractNumbers, type ParsedNumber } from "./number-engine-v2";

// Assuming extractNumbers returns an object like:
// { numbers: ParsedNumber[], cleanedText: string, mathResult: null | MathResult }
interface NumberEngineResult {
    numbers: ParsedNumber[];
    cleanedText: string;
    mathResult: any | null;
}
// Note: Since we don't have the definition for extractNumbers, we must assume its return type.

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

  const rawCleanedText = text.trim().replace(/\u00A0/g, " ").replace(/\s+/g, " ");

  // We cast the result to the assumed structure to fix the type errors.
  const result: any = extractNumbers(rawCleanedText);
  const numbers: ParsedNumber[] = result.numbers ?? (Array.isArray(result) ? result : []);
  const finalCleanedText: string = result.cleanedText ?? rawCleanedText;
  const mathResult: any | null = result.mathResult ?? null;

  const first = numbers[0] || null;

  return {
    numbers: numbers,
    cleanedText: finalCleanedText,
    language: lang,
    hasNumbers: numbers.length > 0,
    hasMath: mathResult !== null, 
    firstNumber: first?.value ?? null,
    quantity: first?.type === "quantity" || first?.type === 'fraction' ? first?.value ?? null : (first?.type === "number" ? first.value : null),
    unit: first?.unit ?? null,
  };
}


// Words we want to strip from the *front* of the phrase
const ACTION_WORDS: Record<string, string[]> = {
  en: ['add', 'order', 'buy', 'get', 'send', 'cost', 'price', 'remove', 'go', 'open', 'help'],
  te: ['pettu', 'teeseyi', 'vellu', 'cheyi', 'dhara', 'entha', 'konu'],
  hi: ['daal', 'nikal', 'hata', 'madad', 'jao', 'kholo', 'daam', 'kya', 'hai', 'kharidna'],
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
    let text = nlu.cleanedText;
    let qty = 1;
    let unit: string | null = null;
    let money: number | null = null;
    
    const numberData = nlu.numbers.length > 0 ? nlu.numbers[0] : null;

    const moneyRegex = /(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయలు)\.?/i;
    const moneyMatch = text.match(moneyRegex);

    if (moneyMatch && numberData) {
        money = numberData.value;
        qty = 1; 
        unit = null;
    } else if (numberData) {
        qty = numberData.value;
        unit = numberData.unit || null;
    }
    
    let phraseForCleanup = text;
    
    if (moneyMatch) {
      phraseForCleanup = phraseForCleanup.replace(moneyRegex, '').trim();
    }

    if (numberData) {
        // Replace the raw number text
        phraseForCleanup = phraseForCleanup.replace(new RegExp(`\\b${numberData.raw}\\b`, 'i'), '').trim();
    }
    
    // Clean up the product phrase by removing action/filler words
    let productPhrase = cleanProductPhrase(phraseForCleanup, nlu.language);
    
    // Final cleanup of remaining quantity/unit words (e.g., 'kilo', 'grams' which were not part of the 'raw' number but are common)
    productPhrase = productPhrase.replace(/\b(kilo|kilogram|grams|gram|gramula|pack|pc|piece)\b/gi, '').trim();
    
    // Clean up specific action/filler words that might remain after number stripping
    productPhrase = cleanProductPhrase(productPhrase, nlu.language);
    
    return { qty, unit, money, productPhrase };
}


/**
 * RECOGNIZE INTENT
 */
export function recognizeIntent(text: string, lang: string): Intent {
    const lower = text.toLowerCase().trim();
  
    // 1) SMART ORDER: "order X from Y to Z"
    if ((lower.startsWith('order') || lower.startsWith('send')) && lower.includes('from') && lower.includes('to')) {
        return { type: 'SMART_ORDER', originalText: text, lang };
    }
  
    // 2) CHECK PRICE
    if (
        lower.includes('price of') ||
        lower.includes('cost of') ||
        lower.includes('cost ') ||
        lower.includes('dhara entha') ||
        lower.includes('daam kya hai')
    ) {
        const cleaned = lower.replace('price of', '').replace('cost of', '').replace('cost', '').replace('dhara entha', '').replace('daam kya hai', '').trim();
        return { type: 'CHECK_PRICE', productPhrase: cleanProductPhrase(cleaned, lang), originalText: text, lang };
    }

    // 3) REMOVE FROM CART
    if (lower.startsWith('remove') || lower.includes('teeseyi') || lower.includes('nikal') || lower.includes('hata')) {
        // Only replace leading 'remove', or inner non-leading removal words
        const cleaned = lower.replace(/^remove\s+/, '').replace(/teeseyi|nikal|hata/g, '').trim();
        return { type: 'REMOVE_ITEM', productPhrase: cleanProductPhrase(cleaned, lang), originalText: text, lang };
    }
  
    // 4) NAVIGATE
    const navPatterns: Record<string, string[]> = {
        orders: ['go to my orders', 'na orderlaku vellu', 'mere orders par jao'],
        cart: ['open cart', 'cart open cheyi'],
    };
    for(const dest in navPatterns) {
        if(navPatterns[dest].some(p => lower.includes(p))) {
            return { type: 'NAVIGATE', destination: dest, originalText: text, lang };
        }
    }

    // 5) CONVERSATIONAL
    if (lower.startsWith('help') || lower.includes('sahayam') || lower.includes('madad')) {
        return { type: 'CONVERSATIONAL', commandKey: 'help', originalText: text, lang };
    }
  
    // 6) ORDER ITEM (fallback)
    const nlu = runNLU(text, lang);
    if (nlu.hasNumbers || text.match(/(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయలు)/i)) {
      return { type: 'ORDER_ITEM', originalText: text, lang };
    }
  
    return { type: 'UNKNOWN', originalText: text, lang };
}
