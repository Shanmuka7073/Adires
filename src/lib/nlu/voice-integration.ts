
'use client';

/**
 * @fileOverview Main integration point for the Voice NLU engine.
 */

import { parseRefsFromText } from './ref-parser';
import { resolveRefData, type RefResolverResult } from './ref-resolver';
import { extractNumbers } from './number-engine-v2';

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
 * MAIN NLU ENTRY: Processes raw transcript into structured actionable data.
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

  // 1. Parse linguistic references (this, that, first, etc.)
  const refs = parseRefsFromText(cleanedText);
  
  // 2. Resolve references and check for math
  const resolved = resolveRefData(cleanedText, refs);

  // 3. Extract numbers and units from the full cleaned text for fallback
  const allNumbers = extractNumbers(cleanedText);

  const first = allNumbers[0] || null;

  return {
    ...resolved,
    numbers: allNumbers,
    cleanedText,
    language: lang,
    hasNumbers: allNumbers.length > 0,
    hasMath: resolved.mathExpression !== null,
    firstNumber: first?.value ?? null,
    quantity: first?.type === 'quantity' || first?.type === 'fraction' ? first?.value ?? null : (first?.type === 'number' ? first.value : null),
    unit: first?.unit ?? null,
  };
}

/**
 * Utility to quickly extract quantity and product phrase for the VoiceCommander.
 */
export { extractQuantityAndProduct, recognizeIntent } from './engine';
