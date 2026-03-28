/**
 * @fileOverview High-efficiency NLU Engine for Voice Ordering.
 * Handles parsing of quantities and fuzzy matching of product names.
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

const NUMBER_MAP: Record<string, number> = {
  "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
  "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
  "half": 0.5, "quarter": 0.25, "a": 1, "an": 1
};

/**
 * Parses a voice transcript into structured order items.
 * Example: "2 chicken biryani and one coke" -> [{name: "chicken biryani", qty: 2}, {name: "coke", qty: 1}]
 */
export function parseOrder(text: string, menu: MenuItem[]): ParsedOrderItem[] {
  const normalized = text.toLowerCase().replace(/,/g, ' and ').trim();
  const parts = normalized.split(/\s+and\s+|\s+also\s+|\s+plus\s+/);
  
  const results: ParsedOrderItem[] = [];

  parts.forEach(part => {
    const tokens = part.trim().split(/\s+/);
    if (tokens.length === 0) return;

    let qty = 1;
    let nameStartIndex = 0;

    // 1. Check for numeric quantity
    const firstToken = tokens[0];
    if (!isNaN(parseInt(firstToken))) {
      qty = parseFloat(firstToken);
      nameStartIndex = 1;
    } 
    // 2. Check for word quantity
    else if (NUMBER_MAP[firstToken]) {
      qty = NUMBER_MAP[firstToken];
      nameStartIndex = 1;
    }

    const itemPhrase = tokens.slice(nameStartIndex).join(' ');
    if (!itemPhrase) return;

    // 3. Find best fuzzy match in menu
    let bestMatch: MenuItem | undefined;
    let highestConfidence = 0;

    menu.forEach(menuItem => {
      const score = calculateSimilarity(itemPhrase, menuItem.name.toLowerCase());
      if (score > highestConfidence) {
        highestConfidence = score;
        bestMatch = menuItem;
      }
    });

    results.push({
      name: itemPhrase,
      quantity: qty,
      originalText: part,
      match: highestConfidence > 0.4 ? bestMatch : undefined,
      confidence: highestConfidence
    });
  });

  return results;
}

/**
 * Legacy stubs kept for compatibility
 */
export function runNLU(text: string, lang: string = "en"): any {
  return { cleanedText: text.trim(), language: lang };
}

export function extractQuantityAndProduct(nlu: any) {
    return { qty: 1, productPhrase: nlu.cleanedText };
}
