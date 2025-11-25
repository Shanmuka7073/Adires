import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Path helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log start
console.log("Running Number Engine Test…");

try {
  // Load JSON file ONLY (NO TypeScript)
  const jsonPath = path.join(__dirname, "../tests/test-phrases.json");
  
  const contents = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(contents);

  // Combine all phrases to get a total count
  const allPhrases = [
    ...(data.en_phrases || []),
    ...(data.te_phrases || []),
    ...(data.hi_phrases || [])
  ];

  // Output result
  console.log("Total phrases:", allPhrases.length);
  if (allPhrases.length > 0) {
    console.log("First phrase:", allPhrases[0]);
  }

  console.log("✔ JavaScript test executed successfully");

} catch (error) {
  console.error("Failed to execute JS test script:", error);
}