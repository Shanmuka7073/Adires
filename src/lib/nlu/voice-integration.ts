
'use client';

// This file is now a lightweight bridge.
// The core, testable logic has been moved to engine.ts

import { runNLU as runNLUEngine, extractQuantityAndProduct as extractQtyEngine, NLUResult } from './engine';

// Re-export the types for use in other client components
export type { NLUResult };

// Main NLU entry point used by VoiceCommander.
// It simply calls the core engine function.
export function runNLU(text: string, lang: string = 'en'): NLUResult {
  return runNLUEngine(text, lang);
}

// Utility used by VoiceCommander to quickly extract quantity + product phrase.
// It also just calls the core engine function.
export function extractQuantityAndProduct(nlu: NLUResult) {
  return extractQtyEngine(nlu);
}
