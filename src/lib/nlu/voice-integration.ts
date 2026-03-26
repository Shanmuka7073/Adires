'use client';

/**
 * @fileOverview Lightweight Voice Integration Entry Point.
 * Dictionaries and heavy parsing have been purged to optimize bundle size.
 */

import { runNLU as stubRun, extractQuantityAndProduct as stubExtract, recognizeIntent as stubRecognize } from './engine';

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

export const runNLU = stubRun;
export const extractQuantityAndProduct = stubExtract;
export const recognizeIntent = stubRecognize;
