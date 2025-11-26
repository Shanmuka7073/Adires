
/**
 * To run this test:
 * 1. Ensure you have ts-node installed: npm install -D ts-node @types/node
 * 2. Run the script from the root directory: npx ts-node scripts/test-nlu.ts
 */

import { runNLU, extractQuantityAndProduct } from '../src/lib/nlu/voice-integration';

function test(phrase: string) {
  console.log("\n--------------------------------");
  console.log("Input:", phrase);
  
  // Assuming runNLU is adapted to be compatible or the test is adjusted.
  // For this test, we'll simulate the NLU result structure if runNLU is complex.
  const nluResult = runNLU(phrase, "en");

  const extracted = extractQuantityAndProduct(nluResult);
  
  console.log("NLU Result:", nluResult);
  console.log("Extracted Quantity and Product:", extracted);
  console.log("--------------------------------\n");
}

const tests = [
  "30 rupees tomatoes",
  "40 rupay potato",
  "half kg onions",
  "1/2 kg carrot",
  "1/4 kg brinjal",
  "3/4 kg beans",
  "100 grams ginger",
  "500 ml milk",
  "2 packet biscuits"
];

tests.forEach(test);
