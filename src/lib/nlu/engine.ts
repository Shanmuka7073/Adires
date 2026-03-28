
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
  thumsup: "thums up",
  "b stick": "stick",
  "b1": "1"
};

const NOISE_WORDS = [
  "please", "give", "add", "i", "want", "me", "needed", "need",
  "kavali", "ivvandi", "petandi",
  "chahiye", "lelo", "mangao",
  "b", "the", "of", "also"
];

const NUMBER_MAP: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  a: 1, an: 1, half: 0.5,

  // Telugu
  okati: 1, rendu: 2, moodu: 3, nalugu: 4,
  aidu: 5, aaru: 6, yedu: 7, enimidi: 8,
  tommidi: 9, padi: 10, oka: 1, ara: 0.5,

  // Hindi
  ek: 1, do: 2, teen: 3, chaar: 4, paanch: 5, adha: 0.5
};

/* =========================
   🔥 UTILS
========================= */

function removeRepetition(words: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    // Only remove if it's an exact repetition of the previous word
    if (i > 0 && words[i] === words[i - 1]) continue;
    result.push(words[i]);
  }
  return result;
}

/**
 * Calculates word-based overlap similarity.
 */
function wordSimilarity(a: string, b: string): number {
  const aWords = a.toLowerCase().split(" ").filter(Boolean);
  const bWords = b.toLowerCase().split(" ").filter(Boolean);

  if (aWords.length === 0) return 0;

  let match = 0;
  aWords.forEach(w => {
    if (bWords.includes(w)) match++;
  });

  const score = (match / aWords.length) * (match / bWords.length);
  if (aWords.length === 1 && bWords.length > 1) return score * 0.5;
  return score;
}

/* =========================
   🧹 CLEAN TEXT
========================= */

export function cleanText(input: string): string {
  let cleaned = input.toLowerCase()
    .replace(/[,.]/g, " ") 
    .replace(/\bb\s+/g, "") 
    .replace(/\bb(\d+)/g, "$1"); 

  let words = cleaned.split(/\s+/)
    .filter(Boolean);

  words = words.map(w => CORRECTIONS_DICT[w] || w);
  words = words.filter(w => !NOISE_WORDS.includes(w));
  words = removeRepetition(words);

  if (words.length > 15) {
    words = words.slice(-10);
  }

  return words.join(" ");
}

/* =========================
   🔢 QUANTITY
========================= */

function extractQuantity(tokens: string[]) {
  let qty = 1;
  let usedIndexes: number[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const num = parseFloat(t);
    if (!isNaN(num)) {
      qty = num;
      usedIndexes.push(i);
      break;
    }
    if (NUMBER_MAP[t]) {
      qty = NUMBER_MAP[t];
      usedIndexes.push(i);
      break;
    }
    const xMatch = t.match(/^x?(\d+)x?$/);
    if (xMatch) {
      qty = parseInt(xMatch[1]);
      usedIndexes.push(i);
      break;
    }
    if (t === "for" && tokens[i + 1]) {
      const next = tokens[i + 1];
      if (NUMBER_MAP[next] || !isNaN(Number(next))) {
        qty = NUMBER_MAP[next] || Number(next);
        usedIndexes.push(i, i + 1);
        break;
      }
    }
  }

  const remaining = tokens.filter((_, i) => !usedIndexes.includes(i));
  return { qty, remaining };
}

/* =========================
   🧠 PRODUCT EXTRACTION
========================= */

function extractProductPhrase(tokens: string[]): string {
  const filtered = tokens.filter(t =>
    !NUMBER_MAP[t] && isNaN(Number(t))
  );
  return filtered.join(" ");
}

/* =========================
   🔍 MATCHING
========================= */

function findBestMatch(input: string, menu: MenuItem[]) {
  let best: MenuItem | undefined;
  let score = 0;

  const inputLower = input.toLowerCase().trim();
  if (!inputLower) return { best: undefined, confidence: 0 };

  for (let item of menu) {
    const name = item.name.toLowerCase();
    if (name === inputLower) return { best: item, confidence: 1.0 };

    let s = wordSimilarity(inputLower, name);
    const inputWords = inputLower.split(" ").filter(Boolean);
    if (name.includes(inputLower)) {
        if (inputWords.length > 1) s += 0.3;
        else if (inputLower.length > 4) s += 0.1;
    }

    const levScore = calculateSimilarity(inputLower, name);
    s = Math.max(s, levScore);

    if (s > score) {
      score = s;
      best = item;
    }
  }

  return { best, confidence: score };
}

/* =========================
   🚀 TYPES & MAIN PARSER
========================= */

export interface NLUResult {
  cleanedText: string;
  language: string;
  items: any[];
}

export type Intent =
  | { type: 'NAVIGATE', destination: string, originalText: string, lang: string }
  | { type: 'CONVERSATIONAL', commandKey: string, originalText: string, lang: string }
  | { type: 'ORDER_ITEM', originalText: string, lang: string }
  | { type: 'UNKNOWN', originalText: string, lang: string };

/**
 * Main NLU runner that parses voice text into items.
 */
export function runNLU(text: string, lang: string = "en", menu: MenuItem[] = []): NLUResult {
  const cleaned = cleanText(text);
  const segments = cleaned.split(/ and | also | next /);

  const results: any[] = [];
  let lastItem: any = null;

  segments.forEach(seg => {
    const tokens = seg.trim().split(" ");
    if (!tokens.length || (tokens.length === 1 && tokens[0] === "")) return;

    if (seg.includes("more") && lastItem) {
      lastItem.quantity += 1;
      return;
    }

    const { qty, remaining } = extractQuantity(tokens);
    const productText = extractProductPhrase(remaining);

    if (!productText || productText.length < 2) return;

    const { best, confidence } = findBestMatch(productText, menu);

    // LOG FAILURE TO DB IF NO GOOD MATCH FOUND
    if (confidence < 0.65) {
        // This is handled by the calling component to have access to Firestore
        return; 
    }

    const item = {
      name: best?.name || productText,
      quantity: qty,
      originalText: seg,
      match: best,
      confidence
    };

    results.push(item);
    lastItem = item;
  });

  const merged: Record<string, any> = {};
  results.forEach(item => {
    if (merged[item.name]) {
      merged[item.name].quantity += item.quantity;
    } else {
      merged[item.name] = item;
    }
  });

  return {
    cleanedText: cleaned,
    language: lang,
    items: Object.values(merged)
  };
}

/**
 * Classifies the user's spoken text into a specific intent.
 */
export function recognizeIntent(text: string, lang: string = "en"): Intent {
  const lower = text.toLowerCase().trim();
  
  if (lower.includes('home') || lower.includes('start')) {
    return { type: 'NAVIGATE', destination: 'home', originalText: text, lang };
  }
  if (lower.includes('cart') || lower.includes('basket')) {
    return { type: 'NAVIGATE', destination: 'cart', originalText: text, lang };
  }
  if (lower.includes('order') && (lower.includes('my') || lower.includes('history'))) {
    return { type: 'NAVIGATE', destination: 'orders', originalText: text, lang };
  }

  if (lower.includes('order') || lower.includes('buy') || lower.includes('get') || lower.includes('add')) {
    return { type: 'ORDER_ITEM', originalText: text, lang };
  }

  return { type: 'UNKNOWN', originalText: text, lang };
}

/**
 * Extracts quantity and product details from the NLU result.
 */
export function extractQuantityAndProduct(nlu: NLUResult) {
    const firstItem = nlu.items[0];
    return { 
        qty: firstItem?.quantity ?? 1, 
        productPhrase: firstItem?.name ?? nlu.cleanedText,
        unit: null as string | null,
        money: null as number | null
    };
}
