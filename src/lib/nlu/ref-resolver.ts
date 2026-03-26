'use client';

/**
 * @fileOverview Simplified Reference Resolver (Purged).
 */

export type RefResolverResult = {
  original: string;
  tokens: string[];
  numbers: any[];
  mathExpression: string | null;
  mathResult: number | null;
  intentHints: string[];
};

export function resolveRefData(text: string, refs: any): RefResolverResult {
  return {
    original: text,
    tokens: refs.clearedTokens || [],
    numbers: [],
    mathExpression: null,
    mathResult: null,
    intentHints: [],
  };
}
