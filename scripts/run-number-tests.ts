/**
 * Run 500 phrase tests through number-engine-v2 and emit CSV results.
 *
 * Save as: scripts/run-number-tests.ts
 * Run with: npx ts-node scripts/run-number-tests.ts
 */

import * as fs from "fs";
import * as path from "path";

// Adjust this import path if your engine location differs
import { extractNumbers, type ParsedNumber } from "../src/lib/nlu/number-engine-v2";

// Where to read phrases from
const TEST_PHRASES_PATH = path.join(process.cwd(), "tests", "test-phrases.json");
// Output CSV
const OUTPUT_CSV = path.join(process.cwd(), "number-engine-test-results.csv");

function escapeForCsvCell(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

function loadPhrases(): string[] {
  if (!fs.existsSync(TEST_PHRASES_PATH)) {
    console.error(`Test phrases file not found at: ${TEST_PHRASES_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(TEST_PHRASES_PATH, "utf8");
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse test-phrases JSON:", e);
    process.exit(1);
  }

  const all: string[] = [];
  if (Array.isArray(json.en_phrases)) all.push(...json.en_phrases);
  if (Array.isArray(json.te_phrases)) all.push(...json.te_phrases);
  if (Array.isArray(json.hi_phrases)) all.push(...json.hi_phrases);

  return Array.from(new Set(all.map(s => (s || "").toString().trim()).filter(Boolean)));
}

function runTests(phrases: string[]) {
  console.log(`Running ${phrases.length} phrases through number-engine-v2...`);
  const rows: string[] = [];

  rows.push([
    "index",
    "phrase",
    "numbers_json",
    "parsed",
    "notes"
  ].map(escapeForCsvCell).join(","));

  phrases.forEach((phrase, idx) => {
    try {
      const numbers: ParsedNumber[] = extractNumbers(phrase);
      const parsed = numbers.length > 0;

      const notes: string[] = [];
      if (!parsed) notes.push("no-numbers-detected");
      if (numbers.length > 5) notes.push("many-numbers");

      rows.push([
        String(idx + 1),
        escapeForCsvCell(phrase),
        escapeForCsvCell(JSON.stringify(numbers)),
        escapeForCsvCell(String(parsed)),
        escapeForCsvCell(notes.join(";"))
      ].join(","));

    } catch (err: any) {
      rows.push([
        String(idx + 1),
        escapeForCsvCell(phrase),
        escapeForCsvCell("[]"),
        escapeForCsvCell("false"),
        escapeForCsvCell("error:" + String(err?.message || err))
      ].join(","));
    }
  });

  fs.writeFileSync(OUTPUT_CSV, rows.join("\n"), "utf8");
  console.log(`Done. Results written to: ${OUTPUT_CSV}`);
}

function main() {
  const phrases = loadPhrases();
  runTests(phrases);
}

main();
