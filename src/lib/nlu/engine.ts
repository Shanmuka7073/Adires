/**
 * 🚀 ADVANCED VOICE ORDERING NLU ENGINE (FINAL)
 * Fully optimized for:
 * - messy speech text
 * - multilingual input
 * - fuzzy matching
 * - mobile performance
 */

import { calculateSimilarity } from "../calculate-similarity";
import type { MenuItem } from "../types";

/* =========================
   🔧 CONFIG
========================= */

const CORRECTIONS_DICT: Record<string, string> = {
  beast: "piece",
  chiken: "chicken",
  stik: "stick",
  bistic: "stick",
  nastic: "stick",
  bryani: "biryani",
  biriyani: "biryani",
  briyani: "biryani",
  coc: "coke",
  kok: "coke",
  thumsup: "thums up"
};

const NOISE_WORDS = [
  "please", "give", "add", "i", "want", "me", "needed", "need", "could", "you",
  "kavali", "ivvandi", "petandi", // Telugu
  "chahiye", "lelo", "do", "mangao" // Hindi
];

const NUMBER_MAP: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  a: 1, an: 1, half: 0.5,

  // Telugu
  okati: 1, rendu: 2, moodu: 3, nalugu: 4,
  aidu: 5, aaru: 6, yedu: 7, enimidi: 8,
  tommidi: 9, padi: 10,
  oka: 1, ara: 0.5,

  // Hindi
  ek: 1, do: 2, teen: 3, chaar: 4, paanch: 5,
  adha: 0.5
};

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
  | { type: 'CONVERSATIONAL'; commandKey: string; originalText: string; lang: string }
  | { type: 'UNKNOWN'; originalText: string; lang: string };

/* =========================
   🔥 UTILS
========================= */

function removeRepetition(words: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && words[i] === words[i - 1]) continue;
    result.push(words[i]);
  }
  return result;
}

function wordSimilarity(a: string, b: string): number {
  const aWords = a.toLowerCase().split(" ");
  const bWords = b.toLowerCase().split(" ");

  let match = 0;
  aWords.forEach(w => {
    if (bWords.includes(w)) match++;
  });

  return match / Math.max(aWords.length, bWords.length);
}

/* =========================
   🧹 CLEAN TEXT
========================= */

export function cleanText(input: string): string {
  let words = input.toLowerCase()
    .replace(/[,.]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // Fix words
  words = words.map(w => CORRECTIONS_DICT[w] || w);

  // Remove noise
  words = words.filter(w => !NOISE_WORDS.includes(w));

  // Remove repetition
  words = removeRepetition(words);

  // Cut garbage long sentences
  if (words.length > 15) {
    words = words.slice(-10);
  }

  return words.join(" ");
}

/* =========================
   🔢 QUANTITY
========================= */

function extractQuantity(tokens: string[]): { qty: number; remaining: string[] } {
  let qty = 1;
  let index = -1;

  tokens.forEach((t, i) => {
    if (!isNaN(Number(t))) {
      qty = Number(t);
      index = i;
    } else if (NUMBER_MAP[t]) {
      qty = NUMBER_MAP[t];
      index = i;
    }
  });

  const remaining = tokens.filter((_, i) => i !== index);

  return { qty, remaining };
}

/* =========================
   🧠 PRODUCT EXTRACTION
========================= */

function extractProduct(tokens: string[]): string {
  const filtered = tokens.filter(t =>
    !NUMBER_MAP[t] && isNaN(Number(t))
  );

  return filtered.slice(-3).join(" ");
}

/* =========================
   🔍 MATCHING
========================= */

function findBestMatch(input: string, menu: MenuItem[]) {
  let best: MenuItem | undefined;
  let score = 0;

  // History boost (Optional enhancement)
  let history: string[] = [];
  if (typeof window !== 'undefined') {
    try {
      history = JSON.parse(localStorage.getItem("orderHistory") || "[]");
    } catch(e) {}
  }

  for (let item of menu) {
    const name = item.name.toLowerCase();

    let s = wordSimilarity(input, name);

    // direct match boost
    if (name.includes(input) || input.includes(name)) s += 0.3;

    // Levenshtein fallback
    const lev = calculateSimilarity(input, name);
    if (lev > 0.7) s += 0.2;

    // history boost
    if (history.includes(item.name)) s += 0.1;

    if (s > score) {
      score = s;
      best = item;
    }
  }

  return { best, confidence: score };
}

/* =========================
   🚀 MAIN PARSER (INTERFACE COMPATIBLE)
========================= */

export function runNLU(
  rawText: string,
  lang: string = "en",
  menu: MenuItem[] = []
): NLUResult {
  const cleaned = cleanText(rawText);

  const segments = cleaned.split(/ and | , | also | plus /);

  const results: ParsedOrderItem[] = [];
  let lastItem: ParsedOrderItem | null = null;

  segments.forEach(seg => {
    const tokens = seg.trim().split(" ");

    if (!tokens.length) return;

    // CONTEXT: "one more"
    if (seg.includes("more") && lastItem) {
      lastItem.quantity += 1;
      return;
    }

    const { qty, remaining } = extractQuantity(tokens);
    const productText = extractProduct(remaining);

    if (!productText) return;

    const { best, confidence } = findBestMatch(productText, menu);

    if (confidence < 0.4) return;

    const item: ParsedOrderItem = {
      name: best?.name || productText,
      quantity: qty,
      originalText: seg,
      match: best,
      confidence
    };

    results.push(item);
    lastItem = item;
  });

  // merge duplicates
  const merged: Record<string, ParsedOrderItem> = {};

  results.forEach(item => {
    const key = item.match?.id || item.name;
    if (merged[key]) {
      merged[key].quantity += item.quantity;
    } else {
      merged[key] = item;
    }
  });

  return {
    rawText,
    cleanedText: cleaned,
    language: lang,
    items: Object.values(merged)
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

/**
 * Helper for test scripts.
 */
export function extractQuantityAndProduct(nlu: NLUResult) {
  const firstItem = nlu.items[0];
  return { 
    qty: firstItem?.quantity ?? 1, 
    productPhrase: firstItem?.name ?? nlu.cleanedText,
    unit: null,
    money: null
  };
}
