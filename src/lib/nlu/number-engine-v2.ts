// number-engine-v2.ts
// SAFE TYPED NUMBER + FRACTION ENGINE

export interface ParsedNumber {
  raw: string;
  value: number;
  type: "number" | "quantity" | "fraction";
  unit?: string | null;
  span: [number, number];
}

// SAFELY TYPED DICTIONARIES
const numberWords: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};

const teluguNumberWords: Record<string, number> = {
  "సున్న": 0, "ఒకటి": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4,
  "ఐదు": 5, "ఆరు": 6, "ఏడు": 7, "ఎనిమిది": 8, "తొమ్మిది": 9, "పది": 10
};

const hindiNumberWords: Record<string, number> = {
  "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4,
  "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10
};

// FRACTIONS
const fractionWords: Record<string, number> = {
  "half": 0.5, "1/2": 0.5, "one half": 0.5,
  "quarter": 0.25, "1/4": 0.25,
  "three fourth": 0.75, "three quarters": 0.75, "3/4": 0.75,

  // Telugu
  "సగం": 0.5, "అర": 0.5, "పావు": 0.25, "మూడొంతులు": 0.75,

  // Hindi
  "आधा": 0.5, "पाव": 0.25, "तीन चौथाई": 0.75
};

export function extractNumbers(text: string): ParsedNumber[] {
  const words = text.split(/\s+/);
  const results: ParsedNumber[] = [];

  let index = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    const spanStart = text.indexOf(words[i], index);
    const spanEnd = spanStart + words[i].length;
    index = spanEnd;

    // FRACTIONS
    if (fractionWords[word] !== undefined) {
      results.push({
        raw: word,
        value: fractionWords[word],
        type: "fraction",
        span: [spanStart, spanEnd],
        unit: null
      });
      continue;
    }

    // ENGLISH
    if (numberWords[word] !== undefined) {
      results.push({
        raw: word,
        value: numberWords[word],
        type: "number",
        span: [spanStart, spanEnd],
        unit: null
      });
      continue;
    }

    // TELUGU
    if (teluguNumberWords[word] !== undefined) {
      results.push({
        raw: word,
        value: teluguNumberWords[word],
        type: "number",
        span: [spanStart, spanEnd],
        unit: null
      });
      continue;
    }

    // HINDI
    if (hindiNumberWords[word] !== undefined) {
      results.push({
        raw: word,
        value: hindiNumberWords[word],
        type: "number",
        span: [spanStart, spanEnd],
        unit: null
      });
      continue;
    }

    // DIGITS
    if (!isNaN(Number(word))) {
      results.push({
        raw: word,
        value: Number(word),
        type: "number",
        span: [spanStart, spanEnd],
        unit: null
      });
      continue;
    }
  }

  return results;
}

// FINAL PUBLIC API (used by NLU)
export function parseNumbers(text: string) {
  return extractNumbers(text);
}
