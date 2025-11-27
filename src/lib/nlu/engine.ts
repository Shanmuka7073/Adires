
// IMPORTANT: This file contains pure, environment-agnostic logic and should NOT have a 'use client' directive.

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

  const moneyRegex = /(?:rs|rupees|₹|rup(?:ay|ayalu|aay)?)\.?\s*(\d+\.?\d*)|(\d+\.?\d*)\s*(?:rs|rupees|₹|rup(?:ay|ayalu|aay)?)\.?/i;
  
  const weightRegex = /(\d+\.?\d*)\s*(kg|kilos?|kilogram|grams?|gm|g|gms)/i;
  const volumeRegex = /(\d+\.?\d*)\s*(liters?|ltrs?|l|milliliters?|ml)/i;
  
  const pieceRegex = /(\d+)\s*(pack|packet|pc|piece|pieces)/i;

  const oneAndHalfRegex = /one and (a )?half/i;
  
  const fractionWords: Record<string, number> = {
    "half": 0.5, "1/2": 0.5, "one half": 0.5,
    "quarter": 0.25, "1/4": 0.25, "one quarter": 0.25,
    "three fourths": 0.75, "three quarters": 0.75, "3/4": 0.75,
    "సగం": 0.5, "అర": 0.5, "పావు": 0.25, "మూడొంతులు": 0.75,
    "आधा": 0.5, "पाव": 0.25, "तीन चौथाई": 0.75
  };

  let match;

  // Check for money, weight, volume, or pieces
  if ((match = text.match(moneyRegex))) {
    money = parseFloat(match[1] || match[2]);
    text = text.replace(match[0], '').trim();
  } else if ((match = text.match(weightRegex))) {
    qty = parseFloat(match[1]);
    const unitRaw = match[2].toLowerCase();
    unit = unitRaw.startsWith('k') ? 'kg' : 'gm';
    text = text.replace(match[0], '').trim();
  } else if ((match = text.match(volumeRegex))) {
    qty = parseFloat(match[1]);
    const unitRaw = match[2].toLowerCase();
    unit = unitRaw.startsWith('l') ? 'ltr' : 'ml';
    text = text.replace(match[0], '').trim();
  } else if ((match = text.match(pieceRegex))) {
    qty = parseInt(match[1], 10);
    unit = 'pc';
    text = text.replace(match[0], '').trim();
  } else if ((match = text.match(oneAndHalfRegex))) {
    qty = 1.5;
    text = text.replace(match[0], '').trim();
    // Check for a unit immediately following "one and half"
    const nextWord = text.split(' ')[0];
    if (nextWord.startsWith('kg') || nextWord.startsWith('kilo')) {
      unit = 'kg';
      text = text.replace(nextWord, '').trim();
    } else if (nextWord.startsWith('ltr') || nextWord.startsWith('liter')) {
      unit = 'ltr';
      text = text.replace(nextWord, '').trim();
    }
  }
  else {
    // Check for fraction words if no other pattern matched
    for (const word in fractionWords) {
        if (text.includes(word)) {
            qty = fractionWords[word];
            // Determine if it's a fraction of a kg or liter
            if (text.includes('liter') || text.includes('litre') || text.includes('ltr')) {
                 unit = 'ltr';
            } else {
                 unit = 'kg'; // Default to kg for fractions if not specified
            }
            // Remove the fraction word AND any unit that follows
            text = text.replace(new RegExp(`${word}\\s*(kg|kilo|gram|gm|liter|litre|ltr)?`, 'i'), '').trim();
            break;
        }
    }
  }
  
  // The remaining text is assumed to be the product phrase, clean up any stray unit words
  const remainder = text.replace(/\b(kg|g|gm|grams|ml|ltr|liter|litre|packet|pack|piece|pieces)\b/g, "").trim();

  return {
    qty,
    unit,
    money,
    productPhrase: remainder
  };
}
