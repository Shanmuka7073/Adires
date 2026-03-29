
'use client';
// Simple Levenshtein distance implementation for fuzzy string matching
export function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a.length === 0) return b.length > 0 ? 0 : 1;
  if (b.length === 0) return a.length > 0 ? 0 : 1;

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

/**
 * Calculates similarity by comparing words individually, making it order-independent.
 * @param userPhrase The phrase spoken by the user.
 * @param productName The name of the product to compare against.
 * @returns An average similarity score from 0 to 1.
 */
export function wordByWordSimilarity(userPhrase: string, productName: string): number {
  const userWords = userPhrase.toLowerCase().split(/\s+/).filter(Boolean);
  const productWords = productName.toLowerCase().split(/\s+/).filter(Boolean);

  if (userWords.length === 0 || productWords.length === 0) {
    return 0;
  }

  let totalScore = 0;

  for (let uWord of userWords) {
    let bestScoreForWord = 0;
    for (let pWord of productWords) {
      const score = calculateSimilarity(uWord, pWord);
      if (score > bestScoreForWord) {
        bestScoreForWord = score;
      }
    }
    totalScore += bestScoreForWord;
  }

  // Return the average score based on the length of the user's phrase
  return totalScore / userWords.length;
}
