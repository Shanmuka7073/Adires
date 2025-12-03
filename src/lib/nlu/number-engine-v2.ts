// src/lib/nlu/number-engine-v2.ts

export interface ParsedNumber {
  raw: string;
  value: number;
  type: "number" | "quantity" | "fraction";
  unit?: string | null;
  span: [number, number];
}

const numberWords: { [key: string]: number } = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

const multipliers: { [key: string]: number } = {
  hundred: 100, thousand: 1000, million: 1000000
};

const teluguNumberWords: Record<string, number> = {
    "సున్న": 0, "ఒకటి": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4, "ఐదు": 5, "ఆరు": 6, "ఏడు": 7, "ఎనిమిది": 8, "తొమ్మిది": 9, "పది": 10,
    "పదకొండు": 11, "పన్నెండు": 12, "పదమూడు": 13, "పద్నాలుగు": 14, "పదిహేను": 15, "పదహారు": 16, "పదిహేడు": 17, "పద్దెనిమిది": 18, "పంతొమ్మిది": 19,
    "ఇరవై": 20, "ముప్పై": 30, "నలభై": 40, "యాభై": 50, "అరవై": 60, "డెబ్బై": 70, "ఎనభై": 80, "తొంభై": 90,
    "వంద": 100, "వెయ్యి": 1000
};

const hindiNumberWords: Record<string, number> = {
    "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15, "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19,
    "बीस": 20, "तीस": 30, "चालीस": 40, "पचास": 50, "साठ": 60, "सत्तर": 70, "अस्सी": 80, "नब्बे": 90,
    "सौ": 100, "हज़ार": 1000
};

const allNumberWords = { ...numberWords, ...teluguNumberWords, ...hindiNumberWords, ...multipliers };

const fractionWords: Record<string, number> = {
  "half": 0.5, "1/2": 0.5, "one-half": 0.5,
  "quarter": 0.25, "1/4": 0.25,
  "three-quarters": 0.75, "3/4": 0.75,
  "paavu": 0.25, "ara": 0.5, "muppavu": 0.75,
  "అర": 0.5, "పావు": 0.25, "ముప్పావు": 0.75,
  "आधा": 0.5, "पाव": 0.25, "पौन": 0.75
};

const units: Record<string, string> = {
  kg: 'kg', kilos: 'kg', kilo: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'gm', gm: 'gm', gram: 'gm', grams: 'gm',
  l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l',
  ml: 'ml', milliliter: 'ml', millilitre: 'ml',
  pc: 'pc', piece: 'pc', pieces: 'pc',
  pack: 'pack', packet: 'pack', packets: 'pack',
  dozen: 'dozen'
};

const combinedNumberAndUnitRegex = new RegExp(`(\\d*\\.?\\d+)\\s*(${Object.keys(units).join('|')})`, 'gi');

function parseWordToNumber(tokens: string[]): number | null {
    let current = 0;
    let result = 0;

    for (const token of tokens) {
        if (allNumberWords[token] !== undefined) {
            const val = allNumberWords[token];
            if (val >= 100) { // Multiplier
                current = current === 0 ? val : current * val;
            } else {
                current += val;
            }
        } else {
            return null; // Not a number word
        }
    }
    result += current;
    return result > 0 ? result : null;
}

export function extractNumbers(text: string): ParsedNumber[] {
  const results: ParsedNumber[] = [];
  let processedText = text;

  // 1. Find combined number-unit tokens like "1kg"
  let match;
  while ((match = combinedNumberAndUnitRegex.exec(processedText)) !== null) {
    const raw = match[0];
    const value = parseFloat(match[1]);
    const unit = units[match[2].toLowerCase()];
    const span: [number, number] = [match.index, match.index + raw.length];
    results.push({ raw, value, type: 'quantity', unit, span });
  }
  // Blank out matched parts to avoid re-parsing
  results.forEach(r => {
    processedText = processedText.substring(0, r.span[0]) + ' '.repeat(r.raw.length) + processedText.substring(r.span[1]);
  });

  const tokens = processedText.toLowerCase().split(/\s+/);
  let currentWordSequence: { word: string, index: number }[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (fractionWords[token] !== undefined) {
        const start = text.toLowerCase().indexOf(token, currentWordSequence.length > 0 ? currentWordSequence[currentWordSequence.length - 1].index + 1 : 0);
        results.push({ raw: token, value: fractionWords[token], type: 'fraction', unit: 'kg', span: [start, start + token.length] });
        continue;
    }

    if (allNumberWords[token] !== undefined || !isNaN(parseFloat(token))) {
        currentWordSequence.push({ word: token, index: i });
    } else if (currentWordSequence.length > 0) {
        // We hit a non-number word, process the sequence we've built
        const numTokens = currentWordSequence.map(t => t.word);
        const value = parseWordToNumber(numTokens);

        if (value !== null) {
            const raw = text.substring(
                text.toLowerCase().indexOf(numTokens[0], tokens.slice(0, currentWordSequence[0].index).join(' ').length),
                text.toLowerCase().indexOf(numTokens[numTokens.length - 1], tokens.slice(0, currentWordSequence[currentWordSequence.length - 1].index).join(' ').length) + numTokens[numTokens.length - 1].length
            );
            
            let unit: string | null = null;
            if (i < tokens.length && units[tokens[i]]) {
                unit = units[tokens[i]];
            }
            results.push({ raw, value, type: 'number', unit, span: [text.indexOf(raw), text.indexOf(raw) + raw.length] });
        }
        currentWordSequence = [];
    }
  }
  
  // Process any remaining sequence at the end of the text
  if (currentWordSequence.length > 0) {
      const numTokens = currentWordSequence.map(t => t.word);
      const value = parseWordToNumber(numTokens);
      if (value !== null) {
        const raw = numTokens.join(' ');
        results.push({ raw, value, type: 'number', unit: null, span: [text.indexOf(raw), text.indexOf(raw) + raw.length] });
      }
  }

  // Final sort by position
  return results.sort((a, b) => a.span[0] - b.span[0]);
}
