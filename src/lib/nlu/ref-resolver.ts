
'use client';

/**
 * @fileOverview Resolves parsed references into structured NLU data.
 */

import { extractNumbers, type ParsedNumber } from './number-engine-v2';
import { safeEvaluate } from '../math-solver';

export type RefResolverResult = {
  original: string;
  tokens: string[];
  numbers: ParsedNumber[];
  mathExpression: string | null;
  mathResult: number | null;
  intentHints: string[];
};

/**
 * Resolves references and extracts numbers/math from the cleared tokens.
 */
export function resolveRefData(text: string, refs: any): RefResolverResult {
  const { clearedTokens } = refs;

  // Use the high-performance number engine to extract quantities and values
  const numResult = extractNumbers(clearedTokens.join(" "));

  let mathResult: number | null = null;
  let mathExpression: string | null = null;

  // Basic math detection: e.g., "5 + 3", "40 - 10"
  const mathy = text.match(/(\d[\d\.\s]*[\+\-\*\/]\s*[\d\.\s]+)/g);
  
  if (mathy) {
    mathExpression = mathy[0].trim();
    mathResult = safeEvaluate(mathExpression);
  }

  const hints: string[] = [];
  if (numResult.length > 0) hints.push('has_numbers');
  if (mathy) hints.push('has_math');

  return {
    original: text,
    tokens: clearedTokens,
    numbers: numResult,
    mathExpression,
    mathResult,
    intentHints: hints,
  };
}
