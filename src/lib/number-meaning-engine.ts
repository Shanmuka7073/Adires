
// number-meaning-engine.ts
// Core number meaning engine. Uses numbers.json (import or require) to map words -> meaning.

import numbersJson from './numbers.json';

type NumberEntry = {
  type: string;
  value?: number | string;
};

export type FoundNumber = {
  raw: string;
  normalizedValue?: number;     // numeric value if quantity or fraction (1, 0.5, ...)
  meaningType?: 'quantity'|'position'|'fraction'|'unit'|'identifier'|'unknown';
  unit?: string;                // kg, meter etc.
  positionIndex?: number;       // for ordinals (1 => first)
  span?: [number, number];      // start/end indices in sentence
};

export type ParsedResult = {
  original: string;
  tokens: string[];
  numbers: FoundNumber[];
  mathExpression?: string;
  mathResult?: number;
  intentHints: string[]; // hints like ADD_TO_CART, REMOVE, CHECK_PRICE, MATH
};

// helper: simple tokenizer (keeps numbers like 1kg separate)
function tokenize(text: string) {
  return text
    .replace(/([0-9]+)([a-zA-Z]+)/g, '$1 $2') // "1kg" -> "1 kg"
    .replace(/([a-zA-Z]+)([0-9]+)/g, '$1 $2')
    .replace(/[.,!?;:()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(t => t.trim());
}

function tryParseNumberToken(tok: string): FoundNumber | null {
  const t = tok.toLowerCase();

  // direct digit
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    return { raw: tok, normalizedValue: Number(t), meaningType: 'quantity' };
  }

  // percent like 50%
  const pct = t.match(/^([0-9]+(\.[0-9]+)?)%$/);
  if (pct) {
    return { raw: tok, normalizedValue: Number(pct[1]) / 100, meaningType: 'fraction' };
  }

  // fraction like 1/2
  const frac = t.match(/^([0-9]+)\/([0-9]+)$/);
  if (frac) {
    const v = Number(frac[1]) / Number(frac[2]);
    return { raw: tok, normalizedValue: v, meaningType: 'fraction' };
  }

  // check in numbers.json maps
  const maps = ['numbers','ordinal','specialNumbers','mathOperations'];
  for (const m of maps) {
    const mapObj: Record<string, NumberEntry> = (numbersJson as any)[m] || {};
    if (mapObj[t]) {
      const e = mapObj[t];
      if (e.type === 'quantity') {
        return { raw: tok, normalizedValue: (e.value as number), meaningType: 'quantity' };
      }
      if (e.type === 'position') {
        return { raw: tok, positionIndex: (e.value as number), meaningType: 'position' };
      }
      if (e.type === 'fraction') {
        return { raw: tok, normalizedValue: (e.value as number), meaningType: 'fraction' };
      }
      if (e.type === 'unit') {
        return { raw: tok, meaningType: 'unit', unit: String(e.value) };
      }
    }
  }

  return null;
}

// detect math-ish expressions like "12 + 5", "what is 5 times 3", or "12+5-3"
function extractMathExpression(tokens: string[]): string | undefined {
  // join tokens and replace words for operators
  const joined = tokens.join(' ').toLowerCase();
  // simple mapping
  const opWords: Record<string,string> = {
    'plus': '+', 'add': '+', 'added': '+',
    'minus': '-', 'subtract': '-', 'less': '-',
    'times': '*', 'into': '*', 'multiply': '*',
    'x': '*',
    'divide': '/', 'by': '/', 'over': '/',
    'mod': '%', 'modulo': '%',
    'square': '**2', 'power': '**', 'pow': '**'
  };

  // prefer explicit symbols if present
  if (/[0-9]\s*[\+\-\*\/\^%]\s*[0-9]/.test(joined)) {
    // sanitize to keep only numbers/operators and parentheses
    const expr = joined.match(/[0-9\.\s\+\-\*\/\^\%\(\)]+/g);
    if (expr) return expr.join(' ').replace(/\s+/g, ' ').trim();
  }

  // replace words -> symbols progressively and check result contains digits+ops
  let candidate = ' ' + joined + ' ';
  for (const w in opWords) {
    const re = new RegExp(`\\b${w}\\b`, 'g');
    candidate = candidate.replace(re, ` ${opWords[w]} `);
  }

  // Attempt to keep only digits/operators/space
  const cleaned = candidate.replace(/[^0-9\.\+\-\*\/\^\%\(\)\s]/g,' ').replace(/\s+/g,' ').trim();
  if (/[0-9].*[\+\-\*\/\^\%].*[0-9]/.test(cleaned)) return cleaned;
  return undefined;
}

export function parseSentenceForNumbers(input: string): ParsedResult {
  const original = input.trim();
  const tokens = tokenize(original);
  const found: FoundNumber[] = [];

  tokens.forEach((tok, idx) => {
    const f = tryParseNumberToken(tok);
    if (f) {
      f.span = [idx, idx+1];
      found.push(f);
      return;
    }

    // look for compound forms like "1kg"
    const kgMatch = tok.match(/^([0-9]+(\.[0-9]+)?)(kg|g|ltr|l|ml|pcs?|pack|packet|pkt)$/i);
    if (kgMatch) {
      const val = Number(kgMatch[1]);
      const unitRaw = kgMatch[3];
      found.push({
        raw: tok,
        normalizedValue: val,
        meaningType: 'quantity',
        unit: unitRaw.toLowerCase(),
        span: [idx, idx+1]
      });
    }
  });

  const mathExpression = extractMathExpression(tokens);
  const intentHints: string[] = [];

  // tiny heuristics for intents (can be extended)
  const lower = original.toLowerCase();
  if (/\b(add|buy|put|add to cart|add cart|add me)\b/.test(lower)) intentHints.push('ADD_TO_CART');
  if (/\b(remove|delete|take out|remove from cart)\b/.test(lower)) intentHints.push('REMOVE_FROM_CART');
  if (/\b(price of|cost of|how much|rate of|dhara|rate)\b/.test(lower)) intentHints.push('CHECK_PRICE');
  if (/\b(order|smart order|from .* to)\b/.test(lower)) intentHints.push('SMART_ORDER');
  if (mathExpression) intentHints.push('MATH');

  // post-process found numbers to convert units via specialNumbers map
  for (const f of found) {
    if (!f.unit) {
      // check next token for unit
      const sidx = f.span ? f.span[1] : -1;
      if (sidx >= 0 && sidx < tokens.length) {
        const look = tokens[sidx].toLowerCase();
        const special = (numbersJson as any).specialNumbers || {};
        if (special[look] && special[look].type === 'unit') {
          f.unit = special[look].value as string;
        } else {
          // simple unit heuristics
          if (/^(kg|kilos?|kilo|kilogram|g|gram|grams|ltr|l|liter|litre|ml|pcs?|piece|packet|pack|pkt)$/.test(look)) {
            f.unit = look;
          }
        }
      }
    }
  }

  return {
    original,
    tokens,
    numbers: found,
    mathExpression,
    intentHints
  };
}
