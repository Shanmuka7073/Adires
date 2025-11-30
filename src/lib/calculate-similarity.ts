
'use client';
// Simple Levenshtein distance implementation for fuzzy string matching
export function calculateSimilarity(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;

  // Convert distance to a similarity score between 0 and 1
  return 1 - distance / maxLength;
}


// --- NEW: Word-Bag Matching ---

/**
 * Normalizes a string into a sorted array of words (a "word bag").
 * This makes comparisons order-independent.
 * @param str The input string.
 * @returns A sorted array of lowercase, alphanumeric words.
 */
function wordBag(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '') // Keep only letters, numbers, and spaces
    .split(/\s+/)
    .filter(Boolean) // Remove empty strings
    .sort();
}

/**
 * Calculates similarity based on the intersection of two word bags.
 * This is order-independent and good for matching phrases with reordered words.
 * @param a The first string.
 * @param b The second string.
 * @returns A similarity score from 0 to 1.
 */
export function bagSimilarity(a: string, b: string): number {
  const bagA = wordBag(a);
  const bagB = new Set(wordBag(b)); // Use a Set for efficient lookups

  if (bagA.length === 0 && bagB.size === 0) return 1;
  if (bagA.length === 0 || bagB.size === 0) return 0;
  
  let matches = 0;
  for (const word of bagA) {
    if (bagB.has(word)) {
      matches++;
    }
  }

  return matches / Math.max(bagA.length, bagB.size);
}
