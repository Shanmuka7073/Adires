
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

  const rawCleanedText = text.trim().replace(/\u00A0/g, " ").replace(/\s+/g, " ");

  const numberResult = extractNumbers(rawCleanedText);
  const first = numberResult[0] || null;

  return {
    numbers: numberResult,
    cleanedText: rawCleanedText,
    language: lang,
    hasNumbers: numberResult.length > 0,
    hasMath: false, 
    firstNumber: first?.value ?? null,
    quantity: first?.type === "quantity" || first?.type === 'fraction' ? first?.value ?? null : (first?.type === "number" ? first.value : null),
    unit: first?.unit ?? null,
  };
}


// Words we want to strip from the *front* of the phrase
const ACTION_WORDS: Record<string, string[]> = {
  en: ['add', 'order', 'buy', 'get', 'send', 'cost', 'price', 'remove', 'go', 'open', 'help'],
  te: ['pettu', 'teeseyi', 'vellu', 'cheyi', 'dhara', 'entha', 'konu'],
  hi: ['daal', 'nikal', 'hata', 'madad', 'jao', 'kholo', 'daam', 'kya', 'hai', 'kharidna', 'dal', 'do'],
};

// Filler words that often appear before the actual product
const FILLER_WORDS = [
  'of', 'from', 'my', 'to', 'the', 'par', 'se', 'nundi', 'ka', 'ki', 'ko', 'lo', 'la', 'rupayala'
];

function cleanProductPhrase(raw: string, lang: string): string {
  let lowerTokens = raw.trim().toLowerCase().split(/\s+/);
  const actionSet = new Set(ACTION_WORDS[lang] ?? []);
  const fillerSet = new Set(FILLER_WORDS);

  // Strip leading action/filler words
  while (lowerTokens.length && (actionSet.has(lowerTokens[0]) || fillerSet.has(lowerTokens[0]))) {
    lowerTokens.shift();
  }
  
  // Strip trailing action/filler words
  while (lowerTokens.length && (actionSet.has(lowerTokens[lowerTokens.length - 1]) || fillerSet.has(lowerTokens[lowerTokens.length - 1]))) {
      lowerTokens.pop();
  }

  return lowerTokens.join(' ').trim();
}

const units = {
  kg: true,
  kilo: true,
  kilogram: true,
  g: true,
  gm: true,
  gram: true,
  grams: true,
  gramula: true,
  litre: true,
  l: true,
  ml: true,
  piece: true,
  pc: true,
  packet: true,
};

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
      phraseForCleanup = phraseForCleanup.toLowerCase().replace(moneyRegex, '').trim();
    }

    if (numberData) {
        phraseForCleanup = phraseForCleanup.replace(new RegExp(`\\b${numberData.raw}\\b`, 'i'), '').trim();
    }
    
    let productPhrase = cleanProductPhrase(phraseForCleanup, nlu.language);
    
    const unitRegex = new RegExp(`\\b(${Object.keys(units).join('|')})\\b`, 'gi');
    productPhrase = productPhrase.replace(unitRegex, '').trim();
    
    productPhrase = cleanProductPhrase(productPhrase, nlu.language);
    
    return { qty, unit, money, productPhrase };
}


/**
 * RECOGNIZE INTENT
 */
export function recognizeIntent(text: string, lang: string): Intent {
    const lower = text.toLowerCase().trim();
  
    if ((lower.startsWith('order') || lower.startsWith('send')) && lower.includes('from') && lower.includes('to')) {
        return { type: 'SMART_ORDER', originalText: text, lang };
    }
  
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

    if (lower.startsWith('remove') || lower.includes('teeseyi') || lower.includes('nikal') || lower.includes('hata')) {
        const cleaned = lower.replace(/^remove\s+/, '').replace(/teeseyi|nikal|hata/g, '').trim();
        return { type: 'REMOVE_ITEM', productPhrase: cleanProductPhrase(cleaned, lang), originalText: text, lang };
    }
  
    const navPatterns: Record<string, string[]> = {
        orders: ['go to my orders', 'na orderlaku vellu', 'mere orders par jao'],
        cart: ['open cart', 'cart open cheyi'],
    };
    for(const dest in navPatterns) {
        if(navPatterns[dest].some(p => lower.includes(p))) {
            return { type: 'NAVIGATE', destination: dest, originalText: text, lang };
        }
    }

    if (lower.startsWith('help') || lower.includes('sahayam') || lower.includes('madad')) {
        return { type: 'CONVERSATIONAL', commandKey: 'help', originalText: text, lang };
    }
  
    const nlu = runNLU(text, lang);
    if (nlu.hasNumbers || text.match(/(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయలు)/i)) {
      return { type: 'ORDER_ITEM', originalText: text, lang };
    }
  
    return { type: 'UNKNOWN', originalText: text, lang };
}
