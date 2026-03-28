/**
 * @fileOverview Advanced NLU Engine for Voice Ordering.
 * Handles multilingual quantity parsing, filler word removal, and fuzzy menu matching.
 */

import { calculateSimilarity } from "../calculate-similarity";
import type { MenuItem } from "../types";

export interface NLUResult {
  cleanedText: string;
  language: string;
  items: ParsedOrderItem[];
}

export interface ParsedOrderItem {
  name: string;
  quantity: number;
  originalText: string;
  match?: MenuItem;
  confidence: number;
}

export type Intent =
  | { type: 'ORDER_ITEM'; originalText: string; lang: string }
  | { type: 'NAVIGATE'; destination: string; originalText: string; lang: string }
  | { type: 'UNKNOWN'; originalText: string; lang: string };

const FILLER_WORDS = [
  "please", "give", "add", "i want", "can you", "needed", "kavali", "chahiye", 
  "order", "get", "buy", "send", "naaku", "ivandi", "lelo", "mangao"
];

const NUMBER_MAP: Record<string, number> = {
  "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
  "half": 0.5, "quarter": 0.25, "a": 1, "an": 1,
  // Telugu
  "okati": 1, "rendu": 2, "moodu": 3, "nalugu": 4, "aidu": 5, "aaru": 6, "yedu": 7, "enimidi": 8, "tommidi": 9, "padi": 10,
  "oka": 1, "ara": 0.5,
  // Hindi
  "ek": 1, "do": 2, "teen": 3, "chaar": 4, "paanch": 5, "che": 6, "saath": 7, "aath": 8, "nau": 9, "das": 10,
  "adha": 0.5
};

/**
 * Advanced normalization to remove filler words and handle punctuation.
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase()
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  FILLER_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    normalized = normalized.replace(regex, '');
  });

  return normalized.trim();
}

/**
 * Extracts quantity from a segment.
 * Checks for numbers at the start, end, or specific phrases like "for 2".
 */
function parseQuantity(tokens: string[]): { qty: number; remainingTokens: string[] } {
  let qty = 1;
  let usedIndex = -1;

  // 1. Check for "for X" pattern
  const forIndex = tokens.indexOf('for');
  if (forIndex !== -1 && tokens[forIndex + 1]) {
    const val = tokens[forIndex + 1];
    const parsed = parseInt(val);
    if (!isNaN(parsed)) {
      return { qty: parsed, remainingTokens: tokens.filter((_, i) => i !== forIndex && i !== forIndex + 1) };
    }
    if (NUMBER_MAP[val]) {
      return { qty: NUMBER_MAP[val], remainingTokens: tokens.filter((_, i) => i !== forIndex && i !== forIndex + 1) };
    }
  }

  // 2. Check for numeric tokens or word tokens at start/end
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const parsed = parseInt(t);
    if (!isNaN(parsed)) {
      qty = parsed;
      usedIndex = i;
      break;
    }
    if (NUMBER_MAP[t]) {
      qty = NUMBER_MAP[t];
      usedIndex = i;
      break;
    }
  }

  const remaining = usedIndex !== -1 ? tokens.filter((_, i) => i !== usedIndex) : tokens;
  return { qty, remainingTokens: remaining };
}

/**
 * Core Parser: Converts raw text into structured items using fuzzy menu matching.
 */
export function parseOrder(text: string, menu: MenuItem[]): ParsedOrderItem[] {
  const normalized = text.toLowerCase().replace(/ and | also | plus | too /g, '|');
  const segments = normalized.split('|').map(s => s.trim()).filter(Boolean);
  
  const results: ParsedOrderItem[] = [];

  segments.forEach(segment => {
    const cleanSegment = normalizeText(segment);
    const tokens = cleanSegment.split(' ');
    if (tokens.length === 0) return;

    const { qty, remainingTokens } = parseQuantity(tokens);
    const productPhrase = remainingTokens.join(' ');
    if (!productPhrase) return;

    // Fuzzy matching logic
    let bestMatch: MenuItem | undefined;
    let highestConfidence = 0;

    menu.forEach(menuItem => {
      const itemName = menuItem.name.toLowerCase();
      // Strategy 1: Direct inclusion (high confidence)
      if (itemName.includes(productPhrase) || productPhrase.includes(itemName)) {
        const score = Math.min(productPhrase.length, itemName.length) / Math.max(productPhrase.length, itemName.length);
        if (score + 0.5 > highestConfidence) {
          highestConfidence = score + 0.5;
          bestMatch = menuItem;
        }
      } 
      // Strategy 2: Levenshtein Similarity
      else {
        const score = calculateSimilarity(productPhrase, itemName);
        if (score > highestConfidence) {
          highestConfidence = score;
          bestMatch = menuItem;
        }
      }
    });

    results.push({
      name: productPhrase,
      quantity: qty,
      originalText: segment,
      match: highestConfidence > 0.4 ? bestMatch : undefined,
      confidence: highestConfidence
    });
  });

  // Merge duplicates
  const merged: Record<string, ParsedOrderItem> = {};
  results.forEach(res => {
    const key = res.match?.id || res.name;
    if (merged[key]) {
      merged[key].quantity += res.quantity;
    } else {
      merged[key] = res;
    }
  });

  return Object.values(merged);
}

/**
 * Classifies intent for global system usage.
 */
export function recognizeIntent(text: string, lang: string = "en"): Intent {
  const lower = text.toLowerCase().trim();
  if (lower.includes('home') || lower.includes('start')) return { type: 'NAVIGATE', destination: 'home', originalText: text, lang };
  if (lower.includes('cart')) return { type: 'NAVIGATE', destination: 'cart', originalText: text, lang };
  return { type: 'ORDER_ITEM', originalText: text, lang };
}

export function runNLU(text: string, lang: string = "en"): NLUResult {
  return { cleanedText: text.trim(), language: lang, items: parseOrder(text, []) };
}

export function extractQuantityAndProduct(nlu: NLUResult) {
    const firstItem = nlu.items[0];
    return { 
        qty: firstItem?.quantity ?? 1, 
        productPhrase: firstItem?.name ?? nlu.cleanedText,
        unit: null,
        money: null
    };
}
