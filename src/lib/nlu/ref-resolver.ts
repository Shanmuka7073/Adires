
'use client';

// src/lib/nlu/ref-resolver.ts
import { parseNumbers } from './number-engine-v2';
import { safeEvaluate } from '../math-solver';

export type RefResolverResult = {
  original: string;
  tokens: string[];
  numbers: any[];
  mathExpression: string | null;
  mathResult: number | null;
  intentHints: string[];
};

function resolveRefs(text: string, refs: any): RefResolverResult {
  const { clearedTokens } = refs;

  // Use new number engine
  const numResult = parseNumbers(clearedTokens.join(" "));

  let mathResult: number | null = null;
  let mathExpression: string | null = null;

  // Basic math detection: e.g., "5 + 3", "40 - 10", "1/2 * 4"
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

// Named export to fix imports
export function resolveRefData(text: string, refs: any) {
  return resolveRefs(text, refs);
}

