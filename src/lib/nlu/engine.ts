/**
 * 🚀 ADVANCED VOICE ORDERING NLU ENGINE (PHONETIC & FUZZY)
 * Optimized for Indian English, Telugu, and Hindi speech fragments.
 */

import { calculateSimilarity } from "../calculate-similarity";
import type { MenuItem } from "../types";

/* =========================
   🔧 CONFIG
========================= */

const NOISE_WORDS = [
  "please", "give", "add", "i", "want", "me", "needed", "need",
  "kavali", "ivvandi", "petandi", "chahiye", "lelo", "mangao",
  "b", "the", "of", "also", "and", "plus"
];

const NUMBER_MAP: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  a: 1, an: 1, half: 0.5,
  okati: 1, rendu: 2, moodu: 3, nalugu: 4,
  aidu: 5, aaru: 6, yedu: 7, enimidi: 8,
  tommidi: 9, padi: 10, oka: 1, ara: 0.5,
  ek: 1, do: 2, teen: 3, chaar: 4, paanch: 5, adha: 0.5
};

/* =========================
   🔥 PHONETIC HASHING
========================= */

/**
 * Sounds-Like Key Generator
 * Strips vowels and double consonants to find matches despite spelling differences.
 */
function getPhoneticKey(str: string): string {
  return str.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/[aeiouyhw]/g, '') // remove vowels and quiet letters
    .replace(/(.)\1+/g, '$1'); // deduplicate (e.g. "kk" -> "k")
}

/**
 * Calculates word-overlap similarity.
 */
function wordSimilarity(a: string, b: string): number {
  const aWords = a.toLowerCase().split(" ").filter(w => w.length > 1);
  const bWords = b.toLowerCase().split(" ").filter(w => w.length > 1);

  if (aWords.length === 0) return 0;

  let matches = 0;
  aWords.forEach(w => {
    if (bWords.includes(w)) matches++;
  });

  return matches / Math.max(aWords.length, bWords.length);
}

/* =========================
   🧠 MATCHING ENGINE
========================= */

function findBestMatch(input: string, menu: MenuItem[]) {
  let best: MenuItem | undefined;
  let maxScore = 0;

  const inputLower = input.toLowerCase().trim();
  const inputPhonetic = getPhoneticKey(inputLower);
  const inputWordsCount = inputLower.split(" ").length;

  for (const item of menu) {
    const name = item.name.toLowerCase();
    const namePhonetic = getPhoneticKey(name);
    
    // 1. Exact Match (Perfect)
    if (name === inputLower) return { best: item, confidence: 1.0 };

    // 2. Word Overlap Score
    let score = wordSimilarity(inputLower, name);

    // 3. Phonetic Match Boost
    if (inputPhonetic && namePhonetic) {
        if (inputPhonetic === namePhonetic) score += 0.5;
        else if (namePhonetic.includes(inputPhonetic)) score += 0.3;
    }

    // 4. Fuzzy Lev Score
    const fuzzy = calculateSimilarity(inputLower, name);
    score = Math.max(score, fuzzy);

    // 5. PENALTY: Prevent short words matching long names (e.g. "Chicken" matching "Chicken Biryani")
    const nameWordsCount = name.split(" ").length;
    if (inputWordsCount < nameWordsCount) {
        // Multiply by coverage ratio
        score *= (inputWordsCount / nameWordsCount); 
    }

    if (score > maxScore) {
      maxScore = score;
      best = item;
    }
  }

  return { best, confidence: maxScore };
}

/* =========================
   🚀 EXPORTS
========================= */

export interface NLUResult {
  cleanedText: string;
  language: string;
  items: any[];
}

export function cleanText(input: string): string {
  return input.toLowerCase()
    .replace(/[,.]/g, " ")
    .split(/\s+/)
    .filter(w => !NOISE_WORDS.includes(w))
    .join(" ");
}

export function runNLU(text: string, lang: string = "en", menu: MenuItem[] = []): NLUResult {
  const cleaned = cleanText(text);
  // Split by common conjunctions
  const segments = cleaned.split(/ also | and | next | then /);
  const items: any[] = [];

  segments.forEach(seg => {
    const tokens = seg.trim().split(" ");
    if (!tokens.length || tokens[0] === "") return;

    // Extract quantity
    let qty = 1;
    const remainingTokens = tokens.filter(t => {
        const num = parseFloat(t);
        if (!isNaN(num)) { qty = num; return false; }
        if (NUMBER_MAP[t]) { qty = NUMBER_MAP[t]; return false; }
        return true;
    });

    const productPhrase = remainingTokens.join(" ");
    if (productPhrase.length < 2) return;

    const { best, confidence } = findBestMatch(productPhrase, menu);

    // Only accept confident matches (Raised threshold to 0.6)
    if (confidence >= 0.6) {
        items.push({
            name: best?.name || productPhrase,
            quantity: qty,
            match: best,
            confidence
        });
    }
  });

  return { cleanedText: cleaned, language: lang, items };
}

export function extractQuantityAndProduct(nlu: NLUResult) {
    const first = nlu.items[0];
    return { 
        qty: first?.quantity ?? 1, 
        productPhrase: first?.name ?? nlu.cleanedText,
        unit: null,
        money: null
    };
}

export function recognizeIntent(text: string, lang: string = "en"): any {
    const lower = text.toLowerCase().trim();
    if (lower.includes('home')) return { type: 'NAVIGATE', destination: 'home' };
    if (lower.includes('cart')) return { type: 'NAVIGATE', destination: 'cart' };
    return { type: 'ORDER_ITEM' };
}