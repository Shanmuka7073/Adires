
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

/**
 * EXTRACT QUANTITY + PRODUCT PHRASE
 */
export function extractQuantityAndProduct(nlu: NLUResult) {
  let qty = 1;
  let unit: string | null = null;
  let money: number | null = null;

  let text = nlu.cleanedText.toLowerCase();

  const numberResults = nlu.numbers;
  
  // New logic using number-engine-v2 results
  if (numberResults.length > 0) {
      const primaryNumber = numberResults[0];
      qty = primaryNumber.value;
      
      const currencyKeywords = ['rs', 'rupees', '₹', 'rupay'];
      const unitKeywords = ['kg', 'kilo', 'g', 'gm', 'grams', 'ml', 'ltr', 'liter', 'litre', 'pack', 'packet', 'pc', 'piece', 'pieces'];

      // Check words immediately after the number for units/currency
      const textAfterNumber = text.substring(primaryNumber.span[1]).trim();
      const nextWord = textAfterNumber.split(' ')[0];

      if (currencyKeywords.some(kw => nextWord.startsWith(kw))) {
          money = primaryNumber.value;
          // Remove number and currency word
          text = text.replace(primaryNumber.raw, '').replace(nextWord, '').trim();
      } else if (unitKeywords.some(kw => nextWord.startsWith(kw))) {
          unit = nextWord;
          text = text.replace(primaryNumber.raw, '').replace(nextWord, '').trim();
      } else {
           text = text.replace(primaryNumber.raw, '').trim();
      }

      // Check words before the number
      const textBeforeNumber = text.substring(0, primaryNumber.span[0]).trim();
      const prevWord = textBeforeNumber.split(' ').pop();
       if (prevWord && currencyKeywords.some(kw => prevWord.startsWith(kw))) {
          money = primaryNumber.value;
          text = text.replace(prevWord, '').replace(primaryNumber.raw, '').trim();
      }
  }


  // Normalize units
  if (unit) {
      const u = unit.toLowerCase();
      if (u.startsWith('g')) unit = 'gm';
      else if (u.startsWith('k')) unit = 'kg';
      else if (u.startsWith('l')) unit = 'ltr';
      else if (u.startsWith('p')) unit = 'pc';
  }

  // Handle fractions
  const fractionWords: Record<string, number> = {
    "half": 0.5, "1/2": 0.5, "one half": 0.5,
    "quarter": 0.25, "1/4": 0.25,
    "three fourth": 0.75, "three quarters": 0.75, "3/4": 0.75,
    "సగం": 0.5, "అర": 0.5, "పావు": 0.25, "మూడొంతులు": 0.75,
    "आधा": 0.5, "पाव": 0.25, "तीन चौथाई": 0.75
  };

  for (const k in fractionWords) {
    if (text.includes(k)) {
      qty = fractionWords[k];
      if (!unit) unit = "kg"; // default unit for fractions
      text = text.replace(k, '').trim();
    }
  }
  
  const remainder = text.trim();

  return {
    qty,
    unit,
    money,
    productPhrase: remainder
  };
}

    