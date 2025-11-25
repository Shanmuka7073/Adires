/**
 * ===========================================================
 *  NUMBER ENGINE v2.0 — Multilingual Numerical NLU
 *  Supports: EN + TE + HI
 *  Author: ChatGPT (for Srinivas)
 * ===========================================================
 */

import numbersBase from "./rules/numbers-base.json";
import customRules from "./rules/custom-rules.json";
import learnedRules from "./rules/learned-rules.json";

type ExtractedNumber = {
  raw: string;
  normalizedValue: number;
  meaningType:
    | "quantity"
    | "unit"
    | "ordinal"
    | "percentage"
    | "fraction"
    | "currency"
    | "math";
  unit?: string;
  span: [number, number];
};

export function extractNumbers(sentence: string) {
  const text = sentence.toLowerCase();

  const tokens = tokenize(text);
  const numbers: ExtractedNumber[] = [];

  const rules = {
    ...numbersBase,
    ...customRules,
    ...learnedRules,
  };

  // ------------------------------------------------------------
  // 1. DIRECT number detection (digits)
  // ------------------------------------------------------------
  tokens.forEach((t, i) => {
    if (/^\d+(\.\d+)?$/.test(t)) {
      numbers.push({
        raw: t,
        normalizedValue: parseFloat(t),
        meaningType: "quantity",
        span: [i, i + 1],
      });
    }
  });

  // ------------------------------------------------------------
  // 2. Percentage detection (5%, 10 percent)
  // ------------------------------------------------------------
  tokens.forEach((t, i) => {
    if (/^\d+%$/.test(t)) {
      numbers.push({
        raw: t,
        normalizedValue: parseFloat(t.replace("%", "")) / 100,
        meaningType: "percentage",
        span: [i, i + 1],
      });
    }

    if (tokens[i + 1] === "percent") {
      numbers.push({
        raw: `${t} percent`,
        normalizedValue: parseFloat(t) / 100,
        meaningType: "percentage",
        span: [i, i + 2],
      });
    }
  });

  // ------------------------------------------------------------
  // 3. English word numbers (one, two, twenty four)
  // ------------------------------------------------------------
  const englishWordMap = rules.english_numbers || {};
  applyWordNumberMap(tokens, englishWordMap, numbers);

  // ------------------------------------------------------------
  // 4. Telugu word numbers (ఒకటి, రెండు…)
  // ------------------------------------------------------------
  const teluguWordMap = rules.telugu_numbers || {};
  applyWordNumberMap(tokens, teluguWordMap, numbers);

  // ------------------------------------------------------------
  // 5. Hindi word numbers (ek, do…)
  // ------------------------------------------------------------
  const hindiWordMap = rules.hindi_numbers || {};
  applyWordNumberMap(tokens, hindiWordMap, numbers);

  // ------------------------------------------------------------
  // 6. Fractions (half, one-third, 1/2, 3/4)
  // ------------------------------------------------------------
  detectFractions(tokens, numbers);

  // ------------------------------------------------------------
  // 7. Ordinals (1st, 2nd, first, second…)
  // ------------------------------------------------------------
  detectOrdinals(tokens, numbers);

  // ------------------------------------------------------------
  // 8. Units (kg, g, litre, pieces, packs)
  // ------------------------------------------------------------
  detectUnits(tokens, numbers);

  // ------------------------------------------------------------
  // 9. Dozen, pair, couple
  // ------------------------------------------------------------
  detectSpecialQuantities(tokens, numbers);

  // ------------------------------------------------------------
  // 10. 1kg 250g → normalize
  // ------------------------------------------------------------
  mergeKgGm(tokens, numbers);

  // ------------------------------------------------------------
  // 11. Math expression extraction
  // ------------------------------------------------------------
  const mathResult = evaluateMathExpression(text);

  return {
    original: sentence,
    tokens,
    numbers,
    mathExpression: mathResult?.expr || null,
    mathResult: mathResult?.value || null,
  };
}

/** -------------------------------------------------------------
 * TOKENIZER
 * ------------------------------------------------------------- */
function tokenize(text: string) {
  return text
    .replace(/[,]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** -------------------------------------------------------------
 * WORD NUMBER MAP HANDLER
 * ------------------------------------------------------------- */
function applyWordNumberMap(
  tokens: string[],
  map: Record<string, number>,
  output: ExtractedNumber[]
) {
  tokens.forEach((t, i) => {
    if (map[t] !== undefined) {
      output.push({
        raw: t,
        normalizedValue: map[t],
        meaningType: "quantity",
        span: [i, i + 1],
      });
    }
  });
}

/** -------------------------------------------------------------
 * FRACTION DETECTION (half, 1/2, one-third)
 * ------------------------------------------------------------- */
function detectFractions(tokens: string[], out: ExtractedNumber[]) {
  const fractionWords: Record<string, number> = {
    half: 0.5,
    "one and half": 1.5,
    "one-third": 1 / 3,
    "one-fourth": 1 / 4,
  };

  tokens.forEach((t, i) => {
    // 1/2, 3/4
    if (/^\d+\/\d+$/.test(t)) {
      const [a, b] = t.split("/").map(Number);
      out.push({
        raw: t,
        normalizedValue: a / b,
        meaningType: "fraction",
        span: [i, i + 1],
      });
    }

    if (fractionWords[t]) {
      out.push({
        raw: t,
        normalizedValue: fractionWords[t],
        meaningType: "fraction",
        span: [i, i + 1],
      });
    }
  });
}

/** -------------------------------------------------------------
 * ORDINALS (1st, 2nd, first, second…)
 * ------------------------------------------------------------- */
function detectOrdinals(tokens: string[], out: ExtractedNumber[]) {
  const ordinals: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    last: -1,
  };

  tokens.forEach((t, i) => {
    // 1st → 1
    const match = t.match(/^(\d+)(st|nd|rd|th)$/);
    if (match) {
      out.push({
        raw: t,
        normalizedValue: parseInt(match[1]),
        meaningType: "ordinal",
        span: [i, i + 1],
      });
    }

    if (ordinals[t]) {
      out.push({
        raw: t,
        normalizedValue: ordinals[t],
        meaningType: "ordinal",
        span: [i, i + 1],
      });
    }
  });
}

/** -------------------------------------------------------------
 * UNITS (kg, gram, litre…)
 * ------------------------------------------------------------- */
function detectUnits(tokens: string[], out: ExtractedNumber[]) {
  const unitList = {
    kg: "kg",
    kilo: "kg",
    kilos: "kg",
    g: "gm",
    gram: "gm",
    grams: "gm",
    litre: "ltr",
    liter: "ltr",
    ltr: "ltr",
    piece: "pc",
    pieces: "pc",
    pack: "pack",
    packet: "pack",
  };

  tokens.forEach((t, i) => {
    if (unitList[t]) {
      out.push({
        raw: t,
        normalizedValue: 1,
        meaningType: "unit",
        unit: unitList[t],
        span: [i, i + 1],
      });
    }
  });
}

/** -------------------------------------------------------------
 * "2 dozen eggs", "couple", "pair"
 * ------------------------------------------------------------- */
function detectSpecialQuantities(tokens: string[], out: ExtractedNumber[]) {
  tokens.forEach((t, i) => {
    if (t === "dozen")
      out.push({
        raw: "dozen",
        normalizedValue: 12,
        meaningType: "quantity",
        span: [i, i + 1],
      });

    if (t === "couple")
      out.push({
        raw: "couple",
        normalizedValue: 2,
        meaningType: "quantity",
        span: [i, i + 1],
      });

    if (t === "pair")
      out.push({
        raw: "pair",
        normalizedValue: 2,
        meaningType: "quantity",
        span: [i, i + 1],
      });
  });
}

/** -------------------------------------------------------------
 * NORMALIZE COMBINED KG + GM
 * "1 kg 200 g" → 1.2
 * ------------------------------------------------------------- */
function mergeKgGm(tokens: string[], out: ExtractedNumber[]) {
  let kg = null;
  let gm = null;

  out.forEach((n) => {
    if (n.unit === "kg") kg = n;
    if (n.unit === "gm") gm = n;
  });

  if (kg && gm) {
    const gramsValue = gm.normalizedValue || 0;
    const kgValue = kg.normalizedValue || 0;
    const finalVal = kgValue + gramsValue / 1000;

    out.push({
      raw: `${kg.raw} + ${gm.raw}`,
      normalizedValue: finalVal,
      meaningType: "quantity",
      span: [kg.span[0], gm.span[1]],
    });
  }
}

/** -------------------------------------------------------------
 * SIMPLE MATH EXTRACTION ("2 + 5%", "1.5 x 2")
 * ------------------------------------------------------------- */
function evaluateMathExpression(text: string) {
  const cleaned = text.replace(/[^0-9\+\-\*\/%\.\s]/g, "");

  try {
    // eslint-disable-next-line no-eval
    const val = eval(cleaned);
    return { expr: cleaned, value: val };
  } catch {
    return null;
  }
}
