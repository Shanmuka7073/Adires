
/**
 * scripts/test-voice-commands.ts
 *
 * Usage:
 * 1) Install dev deps: npm i -D ts-node @types/node tsconfig-paths
 * 2) Run:
 *    npx ts-node -r tsconfig-paths/register scripts/test-voice-commands.ts tests.jsonl report.jsonl
 *
 * tests.jsonl format: each line is a JSON object:
 * { "id": "tc1", "text": "30 rupees tomatoes", "lang": "en", "expect": { "intent": "ORDER_ITEM", "money": 30, "productPhrase": "tomatoes" } }
 *
 * If expect is provided runner compares selected fields and marks fail if mismatch.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

// --- Direct import from the new engine file ---
import { runNLU, extractQuantityAndProduct } from '@/lib/nlu/engine';
import type { NLUResult } from '@/lib/nlu/engine';


type TestCase = {
  id?: string;
  text: string;
  lang?: string;
  expect?: Record<string, any>;
};

type TestResult = {
  id?: string;
  text: string;
  lang: string;
  timestamp: string;
  nlu?: any;
  extracted?: any;
  match?: boolean;
  mismatches?: Record<string, { expected: any; actual: any }>;
  error?: string | null;
};


function compareFields(expect: Record<string, any>, actual: Record<string, any>): Record<string, any> {
  const mismatches: Record<string, any> = {};
  for (const k of Object.keys(expect)) {
    const ev = expect[k];
    const av = actual[k];
    // tolerant compare for numbers and strings
    if (typeof ev === 'number') {
      if (typeof av !== 'number' || Math.abs(ev - av) > 1e-6) {
        mismatches[k] = { expected: ev, actual: av };
      }
    } else if (typeof ev === 'string') {
      if ((av ?? '').toString().toLowerCase() !== ev.toString().toLowerCase()) {
        mismatches[k] = { expected: ev, actual: av };
      }
    } else {
      // fallback deep equal-ish
      try {
        if (JSON.stringify(ev) !== JSON.stringify(av)) {
          mismatches[k] = { expected: ev, actual: av };
        }
      } catch {
        mismatches[k] = { expected: ev, actual: av };
      }
    }
  }
  return mismatches;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    console.error('Usage: npx ts-node -r tsconfig-paths/register scripts/test-voice-commands.ts <tests.jsonl> <output-report.jsonl> [--concurrency=10] [--mode=nlu|match]');
    process.exit(1);
  }

  const testsFile = path.resolve(argv[0]);
  const outFile = path.resolve(argv[1]);
  const concurrencyArg = (argv.find(a => a.startsWith('--concurrency=')) || '--concurrency=10').split('=')[1];
  const concurrency = parseInt(concurrencyArg, 10) || 10;
  const mode = (argv.find(a => a.startsWith('--mode=')) || '--mode=nlu').split('=')[1];

  console.log('Tests file:', testsFile);
  console.log('Output file:', outFile);
  console.log('Concurrency:', concurrency);
  console.log('Mode:', mode);
  
  // optional product catalog fixtures — if you have JSON files of products and aliases place them here
  let productCatalog: { masterProducts?: any[]; productPrices?: Record<string, any> } = {};
  const catalogCandidates = [
    './data/test-master-products.json',
    './data/masterProducts.json',
    './src/lib/data/masterProducts.json'
  ];
  for (const c of catalogCandidates) {
    try {
      if (fs.existsSync(c)) {
        productCatalog = JSON.parse(fs.readFileSync(c, 'utf8'));
        console.log('Loaded product catalog from', c);
        break;
      }
    } catch { /* ignore */ }
  }

  // Very simple alias-to-product matcher used in "match" mode
  function simpleProductMatch(productPhrase: string) {
    if (!productCatalog.masterProducts) return null;
    const phrase = (productPhrase || '').toLowerCase().trim();
    for (const p of productCatalog.masterProducts) {
      if (!p.name) continue;
      if (p.name.toLowerCase().includes(phrase) || phrase.includes(p.name.toLowerCase())) return p;
      if (p.aliases) {
        for (const a of p.aliases) {
          if (a.toLowerCase() === phrase || phrase.includes(a.toLowerCase())) return p;
        }
      }
    }
    return null;
  }

  // streaming read tests.jsonl
  const rl = readline.createInterface({ input: fs.createReadStream(testsFile), crlfDelay: Infinity });
  const outStream = fs.createWriteStream(outFile, { flags: 'w' });

  // concurrency worker queue
  const queue: Promise<void>[] = [];
  let total = 0;
  let failed = 0;

  async function processLine(line: string) {
    if (!line.trim()) return;
    let tc: TestCase;
    try {
      tc = JSON.parse(line);
    } catch (e) {
      const entry: TestResult = { text: line, lang: 'en', timestamp: new Date().toISOString(), error: 'invalid json' };
      outStream.write(JSON.stringify(entry) + '\n');
      failed++;
      return;
    }

    const lang = tc.lang || 'en';
    const result: TestResult = {
      id: tc.id,
      text: tc.text,
      lang,
      timestamp: new Date().toISOString(),
      match: true,
      mismatches: {},
      error: null
    };

    try {
      const nlu = runNLU(tc.text, lang);
      const extracted = extractQuantityAndProduct(nlu);

      result.nlu = nlu;
      result.extracted = extracted;

      if (tc.expect) {
        // build a combined actual object (best-effort) for easy field checks
        const actual: any = {
          intent: (nlu as any).intent || (nlu.hasNumbers ? 'ORDER_ITEM' : 'UNKNOWN'),
          money: (extracted as any).money ?? null,
          qty: (extracted as any).qty ?? nlu.firstNumber ?? null,
          unit: (extracted as any).unit ?? nlu.unit ?? null,
          productPhrase: (extracted as any).productPhrase ?? nlu.cleanedText ?? null,
        };
        const mismatches = compareFields(tc.expect, actual);
        if (Object.keys(mismatches).length > 0) {
          result.match = false;
          result.mismatches = mismatches;
        } else {
          result.match = true;
        }
      } else if (mode === 'match') {
        // run simple match with catalog if available
        const product = simpleProductMatch((extracted as any).productPhrase || nlu.cleanedText);
        result.match = Boolean(product);
        if (!result.match) {
          result.mismatches = { productFound: { expected: 'any product', actual: null } };
        } else {
          result.extracted.matchedProduct = product?.name || null;
        }
      }

    } catch (e:any) {
      result.error = (e && e.message) ? e.message : String(e);
      result.match = false;
    }

    if (!result.match) failed++;
    total++;
    outStream.write(JSON.stringify(result) + '\n');
  }

  for await (const line of rl) {
    // throttle concurrency
    while (queue.length >= concurrency) {
      await Promise.race(queue);
      // purge resolved
      for (let i = queue.length - 1; i >= 0; i--) {
        if ((queue[i] as any).resolved) queue.splice(i, 1);
      }
    }

    const p = processLine(line).then(() => { (p as any).resolved = true; }).catch(() => { (p as any).resolved = true; });
    queue.push(p);
  }

  // wait for all remaining
  await Promise.all(queue);
  outStream.end();

  console.log('Done.');
  console.log('Total tests:', total, 'Failed:', failed);
  console.log('Report saved to', outFile);
}

main().catch(err => {
  console.error('Fatal', err);
  process.exit(1);
});
