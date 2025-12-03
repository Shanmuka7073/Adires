
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
  let qty = 1;
  let unit: string | null = null;
  let money: number | null = null;
  let text = nlu.cleanedText.toLowerCase();

  const moneyRegex =
    /\b(?:₹|rs|rupees|rupay|rupaya|रूपये|రూపాయల)\b\.?\s*(\d+\.?\d*)|\b(\d+\.?\d*)\s*(?:₹|rs|rupees|rupay|रूपये|రూపాయల)\b/i;
  const weightRegex =
    /\b(\d+\.?\d*)\s*\b(kg|kilo|kilogram|grams|gram|gm|g|gms)\b/i;
  const volumeRegex =
    /\b(\d+\.?\d*)\s*\b(liter|litre|liters|litres|ltr|l|ml|milliliter|millilitre)\b/i;
  const pieceRegex = /\b(\d+)\s*\b(pack|packet|pc|piece|pieces)\b/i;
  
  // New: Regex for units without an explicit number (e.g., "kg", "liter")
  const unitOnlyRegex = /\b(kg|kilo|kilogram|grams|gram|gm|g|gms|liter|litre|ltr|l|ml|pc|piece|pieces|pack|packet)\b/i;

  const fractionWords: Record<string, number> = {
    "one and a half": 1.5, "one and half": 1.5, "half": 0.5, "1/2": 0.5, "one half": 0.5,
    "quarter": 0.25, "1/4": 0.25, "one quarter": 0.25,
    "three fourths": 0.75, "three quarters": 0.75, "3/4": 0.75,
    "ఒకటిన్నర": 1.5, "సగం": 0.5, "అర": 0.5, "పావు": 0.25, "మూడొంతులు": 0.75,
    "डेढ़": 1.5, "आधा": 0.5, "पाव": 0.25, "तीन चौथाई": 0.75,
  };

  const liquidKeywords = ['oil', 'milk', 'water', 'juice', 'ghee', 'sauce', 'vinegar'];

  let match;

  // 1) MONEY
  if ((match = text.match(moneyRegex))) {
    const val = match[1] || match[2];
    if (val) money = parseFloat(val);
    text = text.replace(match[0], "").trim();
  }
  // 2) WEIGHT
  else if ((match = text.match(weightRegex))) {
    qty = parseFloat(match[1]);
    unit = match[2].toLowerCase().startsWith("k") ? "kg" : "gm";
    text = text.replace(match[0], "").trim();
  }
  // 3) VOLUME
  else if ((match = text.match(volumeRegex))) {
    qty = parseFloat(match[1]);
    const u = match[2].toLowerCase();
    unit = u.startsWith("l") ? "ltr" : "ml";
    text = text.replace(match[0], "").trim();
  }
  // 4) PIECES
  else if ((match = text.match(pieceRegex))) {
    qty = parseInt(match[1], 10);
    unit = "pc";
    text = text.replace(match[0], "").trim();
  }
  // 5) FRACTIONS & COMPOUND NUMBERS
  else {
    let fractionFound = false;
    for (const key in fractionWords) {
      if (text.includes(key)) {
        qty = fractionWords[key];
        text = text.replace(key, "").trim();
        if (/\b(liter|litre|ltr|liters|litres|ml)\b/.test(text) || liquidKeywords.some(lk => text.includes(lk))) {
          unit = 'ltr';
        } else {
          unit = 'kg';
        }
        fractionFound = true;
        break;
      }
    }
    
    // 6) UNIT ONLY (e.g., "kg chicken") -> implies quantity of 1
    if (!fractionFound && (match = text.match(unitOnlyRegex))) {
        qty = 1;
        const u = match[1].toLowerCase();
        if (u.startsWith('k')) unit = 'kg';
        else if (u.startsWith('g')) unit = 'gm';
        else if (u.startsWith('l')) unit = 'ltr';
        else if (u.startsWith('m')) unit = 'ml';
        else unit = 'pc';
        text = text.replace(match[0], '').trim();
    }
  }

  // 7) CLEANUP
  text = text.replace(/\b(of)\b/gi, "").replace(/\s+/g, ' ').trim();

  let productPhrase = text;
  
  // 🔥 FINAL cleanup of product phrase
  productPhrase = cleanProductPhrase(productPhrase, nlu.language);

  return {
    qty,
    unit,
    money,
    productPhrase: productPhrase,
  };
}

// Stub for Intent type - will be defined in voice-commander
type Intent = any;

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
  if (
    lower.startsWith('add ') ||
    lower.startsWith('order ') ||
    lower.startsWith('oka kilo') ||   // te
    lower.startsWith('do kilo')       // hi
  ) {
    return { type: 'ORDER_ITEM', originalText: text, lang };
  }

  // 7) default
  return { type: 'UNKNOWN', originalText: text, lang };
}
