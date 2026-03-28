/**
 * @fileOverview Advanced NLU Engine for Voice Ordering.
 * Handles text cleaning, tokenization, multilingual quantity extraction, 
 * and fuzzy menu matching entirely on the client side.
 */

import { calculateSimilarity } from "../calculate-similarity";
import type { MenuItem } from "../types";

export interface ParsedOrderItem {
  name: string;
  quantity: number;
  originalText: string;
  match?: MenuItem;
  confidence: number;
}

export interface NLUResult {
  rawText: string;
  cleanedText: string;
  language: string;
  items: ParsedOrderItem[];
}

export type Intent =
  | { type: 'ORDER_ITEM'; originalText: string; lang: string }
  | { type: 'NAVIGATE'; destination: string; originalText: string; lang: string }
  | { type: 'UNKNOWN'; originalText: string; lang: string };

/**
 * Common speech-to-text errors and their corrections.
 */
const CORRECTIONS_DICT: Record<string, string> = {
  "beast": "piece",
  "chiken": "chicken",
  "stik": "stick",
  "bistic": "stick",
  "nastic": "stick",
  "biskit": "biscuit",
  "biskut": "biscuit",
  "bryani": "biryani",
  "biriyani": "biryani",
  "briyani": "biryani",
  "pepsi": "pepsi",
  "coc": "coke",
  "kok": "coke",
  "thumsup": "thums up",
};

/**
 * Words that don't add value to the order intent.
 */
const NOISE_WORDS = [
  "please", "give", "add", "i", "want", "me", "needed", "need", "could", "you",
  "kavali", "ivvandi", "petandi", // Telugu
  "chahiye", "lelo", "do", "mangao" // Hindi
];

/**
 * Multilingual number mapping.
 */
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
 * Step 1: Clean and Normalize the raw transcript.
 */
export function cleanText(input: string): string {
  let words = input.toLowerCase()
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  // 1. Correct common mistakes
  words = words.map(w => CORRECTIONS_DICT[w] || w);

  // 2. Remove Noise Words
  words = words.filter(w => !NOISE_WORDS.includes(w));

  // 3. Remove duplicate repeated words (e.g., "one one" -> "one")
  // Enhanced to handle stuttering or browser repeat errors
  const cleaned: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== words[i - 1]) {
      cleaned.push(words[i]);
    }
  }

  return cleaned.join(' ');
}

/**
 * Step 3: Extract quantity from a segment.
 */
function parseQuantity(tokens: string[]): { qty: number; remainingTokens: string[] } {
  let qty = 1;
  let usedIndex = -1;

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
  const rawCleaned = cleanText(text);
  
  // Split into segments by common delimiters
  const segments = rawCleaned.split(/ and | also | plus | too | , /g)
    .map(s => s.trim())
    .filter(Boolean);
  
  const results: ParsedOrderItem[] = [];

  segments.forEach(segment => {
    const tokens = segment.split(' ');
    const { qty, remainingTokens } = parseQuantity(tokens);
    const productPhrase = remainingTokens.join(' ');
    
    if (!productPhrase) return;

    // Fuzzy matching logic
    let bestMatch: MenuItem | undefined;
    let highestConfidence = 0;

    menu.forEach(menuItem => {
      const itemName = menuItem.name.toLowerCase();
      
      // Strategy 1: Direct inclusion (e.g. "biryani" in "Chicken Biryani")
      if (itemName.includes(productPhrase) || productPhrase.includes(itemName)) {
        const score = Math.min(productPhrase.length, itemName.length) / Math.max(productPhrase.length, itemName.length);
        if (score + 0.4 > highestConfidence) {
          highestConfidence = score + 0.4;
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
      match: highestConfidence > 0.5 ? bestMatch : undefined,
      confidence: highestConfidence
    });
  });

  // Merge duplicates (e.g. user said "one coke" ... "and one more coke")
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
 * Global entry point for NLU.
 */
export function runNLU(text: string, lang: string = "en", menu: MenuItem[] = []): NLUResult {
  const cleaned = cleanText(text);
  const items = parseOrder(text, menu);
  
  return {
    rawText: text,
    cleanedText: cleaned,
    language: lang,
    items
  };
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

export function extractQuantityAndProduct(nlu: NLUResult) {
    const firstItem = nlu.items[0];
    return { 
        qty: firstItem?.quantity ?? 1, 
        productPhrase: firstItem?.name ?? nlu.cleanedText,
        unit: null,
        money: null
    };
}
