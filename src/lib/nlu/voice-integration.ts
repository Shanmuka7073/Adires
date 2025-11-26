
'use client';
import { parseRefsFromText } from './ref-parser';
import { resolveRefData, RefResolverResult } from './ref-resolver';

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
 * Main NLU entry point used by VoiceCommander.
 * Takes raw voice text → returns complete NLU analysis.
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

  const first = resolved.numbers[0] || null;

  return {
    ...resolved,
    cleanedText,
    language: lang,
    hasNumbers: resolved.numbers.length > 0,
    hasMath: resolved.mathExpression !== null,
    firstNumber: first?.value ?? null,
    quantity: first?.type === 'quantity' || first?.unit ? first?.value ?? null : null,
    unit: first?.unit ?? null,
  };
}

/**
 * Utility used by VoiceCommander to quickly extract quantity + product phrase.
 */
export function extractQuantityAndProduct(nlu: NLUResult) {
  let qty = nlu.quantity ?? nlu.firstNumber ?? 1;
  let unit = nlu.unit ?? null;

  let remainder = nlu.cleanedText;
  if (nlu.numbers.length > 0) {
    const span = nlu.numbers[0].span;
    remainder = nlu.cleanedText.slice(span[1]).trim();
  }

  remainder = remainder.replace(/^(kg|gm|g|ml|ltr|pack|packet|pc|piece|pieces)/i, '').trim();

  if (!remainder) remainder = nlu.cleanedText;

  return {
    qty,
    unit,
    productPhrase: remainder,
  };
}
