
'use client';

/**
 * @fileOverview Stubbed Voice Integration (Nested Path) to resolve build failures.
 */

import { runNLU as runNLUStub, extractQuantityAndProduct as extractStub, recognizeIntent as recognizeStub } from './engine';

export interface NLUResult {
  cleanedText: string;
  language: string;
  hasNumbers: boolean;
  hasMath: boolean;
  firstNumber: number | null;
  quantity: number | null;
  unit: string | null;
  numbers: any[];
}

export function runNLU(text: string, lang: string = 'en'): NLUResult {
    return runNLUStub(text, lang);
}

export const extractQuantityAndProduct = extractStub;
export const recognizeIntent = recognizeStub;
