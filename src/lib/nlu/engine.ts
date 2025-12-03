// IMPORTANT: Pure logic file (NO use client)

import { parseRefsFromText } from "./ref-parser";
import { resolveRefData, type RefResolverResult } from "./ref-resolver";
import { extractNumbers, type ParsedNumber } from "./number-engine-v2";

export interface NLUResult extends RefResolverResult {
  cleanedText: string;
  language: string;
  hasNumbers: boolean;
  hasMath: boolean;
  firstNumber: number | null;
  quantity: number | null;
  unit: string | null;
  numbers: ParsedNumber[];
}

/**
 * MAIN NLU ENTRY
 */
export function runNLU(text: string, lang: string = "en"): NLUResult {
  if (!text || typeof text !== "string") {
    return {
      original: "",
      tokens: [],
      numbers: [],
      mathExpression: null,
      mathResult: null,
      intentHints: [],
      cleanedText: "",
      language: lang,
      hasNumbers: false,
      hasMath: false,
      firstNumber: null,
      quantity: null,
      unit: null,
    };
  }

  const cleanedText = text.trim().replace(/\u00A0/g, " ").replace(/\s+/g, " ");

  // The new number engine is more robust, so we use it directly.
  const numbers = extractNumbers(cleanedText);
  const first = numbers[0] || null;

  // The old ref parser is still useful for positional things like "first", "last"
  const refs = parseRefsFromText(cleanedText);
  const resolved = resolveRefData(cleanedText, refs);

  return {
    ...resolved,
    numbers,
    cleanedText,
    language: lang,
    hasNumbers: numbers.length > 0,
    hasMath: resolved.mathExpression !== null,
    firstNumber: first?.value ?? null,
    quantity: first?.type === "quantity" ? first?.value ?? null : (first?.type === "number" || first?.type === "fraction" ? first.value : null),
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
    let qty = 1;
    let unit: string | null = null;
    let money: number | null = null;
    let text = nlu.cleanedText.toLowerCase();

    // Use the more powerful number engine's output
    if (nlu.numbers.length > 0) {
        const firstNum = nlu.numbers[0];
        qty = firstNum.value;
        unit = firstNum.unit || null;

        // Remove the parsed number phrase from the text to isolate the product phrase
        text = text.substring(0, firstNum.span[0]) + text.substring(firstNum.span[1]);
    }
    
    // Check for money separately as it's a special case
    const moneyRegex = /(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయల)\.?\s*(\d+\.?\d*)|(\d+\.?\d*)\s*(?:rs|rupees|₹|rupay|rupayala|रूपये|రూపాయల)\.?/i;
    let match;
    if ((match = text.match(moneyRegex))) {
        money = parseFloat(match[1] || match[2]);
        text = text.replace(match[0], "").trim();
    }


    const productPhrase = cleanProductPhrase(text, nlu.language);

    return {
        qty,
        unit,
        money,
        productPhrase,
    };
}
