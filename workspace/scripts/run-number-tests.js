
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Running Number Engine Test…");

try {
  // Load JSON
  const jsonPath = path.join(__dirname, "../tests/test-phrases.json");
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  // Combine all phrases into a single array
  const allPhrases = [...(data.en_phrases || []), ...(data.te_phrases || []), ...(data.hi_phrases || [])];

  // Simple test: just print sample
  console.log("Loaded", allPhrases.length, "phrases");
  if (allPhrases.length > 0) {
    console.log("First phrase:", allPhrases[0]);
  } else {
    console.log("The test-phrases.json file is empty.");
  }

  console.log("✔ Test script executed successfully!");

} catch (error) {
    console.error("Failed to run the test script:", error);
}
