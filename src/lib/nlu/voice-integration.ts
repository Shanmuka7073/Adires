
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

  const moneyRegex = /(?:rs|rupees|₹|rupay|rupayalu)\.?\s*(\d+\.?\d*)|(\d+\.?\d*)\s*(?:rs|rupees|₹|rupay|rupayalu)\.?/i;
  
  // This more specific regex prevents "g" from matching "kg" accidentally.
  const weightRegex = /(\d+\.?\d*)\s*(kg|kilos?|kilogram|grams?|gm|g|gms|milliliter|ml|liters?|ltr|గ్రాములు|గ్రామ్లు|గ్రాం|గ్రాము|గ్రామ్స్|జీ ఎం)/i;
  
  const pieceRegex = /(\d+)\s*(pack|packet|pc|piece|pieces)/i;
  
  const fractionWords: Record<string, number> = {
    "half": 0.5, "1/2": 0.5, "one half": 0.5,
    "quarter": 0.25, "1/4": 0.25,
    "three fourths": 0.75, "three quarters": 0.75, "3/4": 0.75,
    "సగం": 0.5, "అర": 0.5, "పావు": 0.25, "మూడొంతులు": 0.75,
    "आधा": 0.5, "पाव": 0.25, "तीन चौथाई": 0.75
  };

  let match;

  // Check for money, weight, or pieces
  if ((match = text.match(moneyRegex))) {
    money = parseFloat(match[1] || match[2]);
    text = text.replace(match[0], '').trim();
  } else if ((match = text.match(weightRegex))) {
    qty = parseFloat(match[1]);
    const unitRaw = match[2].toLowerCase();
    
    // Normalize unit
    if (unitRaw.startsWith('k')) {
        unit = 'kg';
    } else if (unitRaw.startsWith('g') || unitRaw.startsWith('గ్రా') || unitRaw.startsWith('జీ')) {
        unit = 'gm'; 
    } else if (unitRaw.startsWith('m') || unitRaw.startsWith('l')) {
        unit = 'ml';
    }
    text = text.replace(match[0], '').trim();
  } else if ((match = text.match(pieceRegex))) {
    qty = parseInt(match[1], 10);
    unit = 'pc';
    text = text.replace(match[0], '').trim();
  } else {
    // Check for fraction words if no other pattern matched
    for (const word in fractionWords) {
        if (text.includes(word)) {
            qty = fractionWords[word];
            unit = 'kg'; // Assume fractions of a kilo by default
            text = text.replace(word, '').trim();
            break;
        }
    }
  }
  
  // The remaining text is assumed to be the product phrase
  const remainder = text.trim();

  return {
    qty,
    unit,
    money,
    productPhrase: remainder
  };
}
