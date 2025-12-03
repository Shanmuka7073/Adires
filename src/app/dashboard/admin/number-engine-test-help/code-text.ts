
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Store, ShoppingBag, ArrowRight, Mic, List, FileText, Server, BookOpen, Beaker, Bot, FileSignature, Shield, BrainCircuit, Fingerprint, Voicemail, KeyRound, Bug, AlertTriangle, Download, Search, Check, X, Loader2, BookCopy, Upload, MessageSquare, ImageIcon, Home, Lightbulb, Binary, TestTube, Cog, Share2, Monitor, Drama } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect, useState, useTransition, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { collection, query, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import type { Order, Store as StoreType, Product, ProductPrice, ProductVariant, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useAppStore } from '@/lib/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { bulkUploadRecipes, importProductsFromUrl } from '@/app/actions';


export const numberEngineTestCode = [
    {
        path: 'scripts/run-number-tests.ts',
        content: `
/**
 * Run 500 phrase tests through number-engine-v2 and emit CSV results.
 *
 * Save as: scripts/run-number-tests.ts
 * Run with: npx ts-node scripts/run-number-tests.ts
 */

import * as fs from "fs";
import * as path from "path";

// Adjust this import path if your engine location differs
import { extractNumbers } from "../src/lib/nlu/number-engine-v2";

// Where to read phrases from (expected JSON format from earlier message)
const TEST_PHRASES_PATH = path.join(process.cwd(), "tests", "test-phrases.json");
// Output CSV
const OUTPUT_CSV = path.join(process.cwd(), "number-engine-test-results.csv");

// Utility: safely stringify JSON for CSV cell
function escapeForCsvCell(s: string) {
  // wrap in quotes and escape inner quotes
  return \`"\${s.replace(/"/g, '""')}"\`;
}

// Load phrases. Expect object with keys: en_phrases, te_phrases, hi_phrases
function loadPhrases(): string[] {
  if (!fs.existsSync(TEST_PHRASES_PATH)) {
    console.error(\`Test phrases file not found at: \${TEST_PHRASES_PATH}\`);
    console.error("Create the file and paste the JSON from the test phrases list I gave earlier.");
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

  // Remove duplicates and empty strings
  return Array.from(new Set(all.map(s => (s || "").toString().trim()).filter(Boolean)));
}

function runTests(phrases: string[]) {
  console.log(\`Running \${phrases.length} phrases through number-engine-v2...\`);
  const rows: string[] = [];

  // CSV header
  rows.push([
    "index",
    "phrase",
    "tokens",
    "numbers_json",
    "mathExpression",
    "mathResult",
    "parsed",
    "notes"
  ].map(escapeForCsvCell).join(","));

  phrases.forEach((phrase, idx) => {
    try {
      const result = extractNumbers(phrase);

      // Determine "parsed" heuristics:
      // parsed = has at least one extracted number OR mathResult exists
      const parsed = (Array.isArray(result.numbers) && result.numbers.length > 0) || result.mathResult !== null;

      const notes: string[] = [];
      if (!parsed) notes.push("no-numbers-detected");
      // Add more heuristics if needed (e.g., too many tokens, suspicious output)
      if (result.numbers && result.numbers.length > 5) notes.push("many-numbers");

      // CSV row
      const tokensStr = Array.isArray(result.tokens) ? result.tokens.join(" ") : "";
      const numbersJson = JSON.stringify(result.numbers || []);
      const mathExpr = result.mathExpression ? String(result.mathExpression) : "";
      const mathVal = result.mathResult !== null ? String(result.mathResult) : "";

      rows.push([
        String(idx + 1),
        escapeForCsvCell(phrase),
        escapeForCsvCell(tokensStr),
        escapeForCsvCell(numbersJson),
        escapeForCsvCell(mathExpr),
        escapeForCsvCell(mathVal),
        escapeForCsvCell(String(parsed)),
        escapeForCsvCell(notes.join(";"))
      ].join(","));

    } catch (err: any) {
      rows.push([
        String(idx + 1),
        escapeForCsvCell(phrase),
        escapeForCsvCell(""),
        escapeForCsvCell(""),
        escapeForCsvCell(""),
        escapeForCsvCell(""),
        escapeForCsvCell("false"),
        escapeForCsvCell("error:" + String(err?.message || err))
      ].join(","));
      console.error(\`Error while parsing phrase #\${idx + 1}: "\${phrase}"\`, err);
    }
  });

  // Write CSV
  fs.writeFileSync(OUTPUT_CSV, rows.join("\\n"), "utf8");
  console.log(\`Done. Results written to: \${OUTPUT_CSV}\`);
}

function main() {
  const phrases = loadPhrases();
  runTests(phrases);
}

main();
`,
    },
];
