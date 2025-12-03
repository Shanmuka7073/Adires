
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
  hundred: 100, thousand: 1000, million: 1000000,
  lakh: 100000, crore: 10000000,
  vandala: 100, // te
  sau: 100, // hi
  hazaar: 1000, // hi
};

const teluguNumberWords: Record<string, number> = {
    "సున్న": 0, "ఒకటి": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4, "ఐదు": 5, "ఆరు": 6, "ఏడు": 7, "ఎనిమిది": 8, "తొమ్మిది": 9, "పది": 10,
    "పదకొండు": 11, "పన్నెండు": 12, "పదమూడు": 13, "పద్నాలుగు": 14, "పదిహేను": 15, "పదహారు": 16, "పదిహేడు": 17, "పద్దెనిమిది": 18, "పంతొమ్మిది": 19,
    "ఇరవై": 20, "ముప్పై": 30, "నలభై": 40, "యాభై": 50, "అరవై": 60, "డెబ్బై": 70, "ఎనభై": 80, "తొంభై": 90,
    "వంద": 100, "వెయ్యి": 1000,
    // Transliterations
    "oka": 1, "okati": 1, "rendu": 2, "moodu": 3, "nalugu": 4, "ayidu": 5, "aaru": 6, "yedu": 7, "enimidi": 8, "thommidi": 9, "padi": 10,
    "iravai": 20, "muppai": 30, "nalabhai": 40, "yabhai": 50
};

const hindiNumberWords: Record<string, number> = {
    "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15, "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19,
    "बीस": 20, "तीस": 30, "चालीस": 40, "पचास": 50, "साठ": 60, "सत्तर": 70, "अस्सी": 80, "नब्बे": 90,
    "सौ": 100, "हज़ार": 1000,
    // Transliterations
    "ek": 1, "do": 2, "teen": 3, "char": 4, "chaar": 4, "panch": 5, "paanch": 5
};

const allNumberWords = { ...numberWords, ...teluguNumberWords, ...hindiNumberWords, ...multipliers };

const fractionWords: Record<string, number> = {
  "half": 0.5, "1/2": 0.5, "one-half": 0.5, "one and a half": 1.5,
  "quarter": 0.25, "1/4": 0.25,
  "three-quarters": 0.75, "3/4": 0.75,
  "paavu": 0.25, "ara": 0.5, "muppavu": 0.75,
  "అర": 0.5, "పావు": 0.25, "ముప్పావు": 0.75,
  "ఆధా": 0.5, "पाव": 0.25, "पौन": 0.75
};

const units: Record<string, string> = {
  kg: 'kg', kilos: 'kg', kilo: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'gm', gm: 'gm', gram: 'gm', grams: 'gm', gramula: 'gm',
  l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l',
  ml: 'ml', milliliter: 'ml', millilitre: 'ml',
  pc: 'pc', piece: 'pc', pieces: 'pc',
  pack: 'pack', packet: 'pack', packets: 'pack',
  dozen: 'dozen'
};

const combinedNumberAndUnitRegex = new RegExp(`(\\d*\\.?\\d+)\\s*(${Object.keys(units).join('|')})`, 'gi');

function textToNumber(words: string[]): number {
    let current = 0;
    let result = 0;

    for (const word of words) {
        const value = allNumberWords[word];
        if (value !== undefined) {
            if (value >= 100) { // It's a multiplier
                current = current === 0 ? 1 : current;
                result += current * value;
                current = 0;
            } else {
                current += value;
            }
        }
    }
    result += current;
    return result;
}


export function extractNumbers(text: string): ParsedNumber[] {
  const results: ParsedNumber[] = [];
  let remainingText = text;

  // 1. Find combined number-unit tokens like "1kg" first
  let match;
  while ((match = combinedNumberAndUnitRegex.exec(remainingText)) !== null) {
    const raw = match[0];
    const value = parseFloat(match[1]);
    const unit = units[match[2].toLowerCase()];
    const span: [number, number] = [match.index, match.index + raw.length];
    results.push({ raw, value, type: 'quantity', unit, span });
    // Replace found part with placeholders to avoid re-matching
    remainingText = remainingText.substring(0, span[0]) + ' '.repeat(raw.length) + remainingText.substring(span[1]);
  }

  // Regex for fractions, standalone numbers, and text numbers
  const allWords = Object.keys(allNumberWords).join('|');
  const allFractions = Object.keys(fractionWords).join('|').replace(/\//g, '\\/');
  const numberRegex = new RegExp(
      `\\b(${allFractions}|${allWords}|\\d+\\.?\\d*)\\b`
      + `(?:\\s+(?:and\\s+a\\s+)?(?:${allFractions}|${allWords}))*` // handles "one and a half" or "two hundred fifty"
      + `(?:\\s+(${Object.keys(units).join('|')}))?`, 'gi'
  );

  while ((match = numberRegex.exec(remainingText)) !== null) {
      const raw = match[0].trim();
      const unitWord = match[match.length - 1]; // last captured group is the unit
      let numberPart = raw;

      if (unitWord && raw.endsWith(unitWord)) {
          numberPart = raw.substring(0, raw.length - unitWord.length).trim();
      }
      
      const span: [number, number] = [match.index, match.index + raw.length];

      // Avoid re-processing if this span is already covered by a combined match
      if (results.some(r => span[0] >= r.span[0] && span[1] <= r.span[1])) {
          continue;
      }

      let value: number;
      let type: "number" | "quantity" | "fraction" = 'number';

      if (fractionWords[numberPart] !== undefined) {
          value = fractionWords[numberPart];
          type = 'fraction';
      } else if (!isNaN(parseFloat(numberPart))) {
          value = parseFloat(numberPart);
      } else {
          value = textToNumber(numberPart.split(/\s+/));
      }

      const unit = unitWord ? units[unitWord.toLowerCase()] : null;
      if (unit) type = 'quantity';

      results.push({ raw: numberPart, value, type, unit, span });
  }

  return results.sort((a, b) => a.span[0] - b.span[0]);
}
