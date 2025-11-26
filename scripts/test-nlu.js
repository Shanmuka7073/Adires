
const { runNLU, extractQuantityAndProduct } = require("../src/lib/nlu/voice-integration");

function test(phrase) {
  console.log("\n--------------------------------");
  console.log("Input:", phrase);
  const nlu = runNLU(phrase, "en");
  const extracted = extractQuantityAndProduct(nlu);
  console.log("NLU:", nlu);
  console.log("Extracted:", extracted);
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
