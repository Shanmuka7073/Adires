
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
  vandala: 100, // te
  lakh: 100000, // hi
};

const teluguNumberWords: Record<string, number> = {
    "సున్న": 0, "ఒకటి": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4, "ఐదు": 5, "ఆరు": 6, "ఏడు": 7, "ఎనిమిది": 8, "తొమ్మిది": 9, "పది": 10,
    "పదకొండు": 11, "పన్నెండు": 12, "పదమూడు": 13, "పద్నాలుగు": 14, "పదిహేను": 15, "పదహారు": 16, "పదిహేడు": 17, "పద్దెనిమిది": 18, "పంతొమ్మిది": 19,
    "ఇరవై": 20, "ముప్పై": 30, "నలభై": 40, "యాభై": 50, "అరవై": 60, "డెబ్బై": 70, "ఎనభై": 80, "తొంభై": 90,
    "వంద": 100, "వెయ్యి": 1000,
    // Transliterations
    "oka": 1, "okati": 1, "rendu": 2, "moodu": 3, "nalugu": 4, "aidu": 5, "aaru": 6, "yedu": 7, "enimidi": 8, "thommidi": 9, "padi": 10,
    "iravai": 20, "muppai": 30, "nalabhai": 40, "yabhai": 50
};

const hindiNumberWords: Record<string, number> = {
    "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15, "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19,
    "बीस": 20, "तीस": 30, "चालीस": 40, "पचास": 50, "साठ": 60, "सत्तर": 70, "अस्सी": 80, "नब्बे": 90,
    "सौ": 100, "हज़ार": 1000
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

function textToNumber(text: string): number {
    const words = text.toLowerCase().split(/[\s-]+/);
    let current = 0;
    let result = 0;
    for (const word of words) {
        if (allNumberWords[word] !== undefined) {
            const val = allNumberWords[word];
            if (val === 100) {
                current = current === 0 ? 100 : current * 100;
            } else if (val >= 1000) {
                result += current * val;
                current = 0;
            } else {
                current += val;
            }
        }
    }
    result += current;
    return result;
}

export function extractNumbers(text: string): ParsedNumber[] {
  const results: ParsedNumber[] = [];
  let processedText = text;

  // 1. Find combined number-unit tokens like "1kg" first
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

  // 2. Find fractions and remaining numbers
  const tokens = processedText.toLowerCase().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    let currentPhrase = tokens.slice(i).join(' ');
    
    // Check for fraction words
    for (const fracWord in fractionWords) {
        if (currentPhrase.startsWith(fracWord)) {
            const start = text.toLowerCase().indexOf(fracWord, i > 0 ? text.toLowerCase().indexOf(tokens[i-1]) + tokens[i-1].length : 0);
            results.push({ raw: fracWord, value: fractionWords[fracWord], type: 'fraction', unit: 'kg', span: [start, start + fracWord.length]});
            i += fracWord.split(' ').length -1;
            continue;
        }
    }

    // Check for text-based numbers
    let numberWordSequence = "";
    let temp_i = i;
    while(temp_i < tokens.length && allNumberWords[tokens[temp_i]] !== undefined) {
        numberWordSequence += (numberWordSequence ? " " : "") + tokens[temp_i];
        temp_i++;
    }

    if (numberWordSequence) {
        const value = textToNumber(numberWordSequence);
        const start = text.toLowerCase().indexOf(numberWordSequence);
        let unit: string | null = null;
        if(temp_i < tokens.length && units[tokens[temp_i]]) {
             unit = units[tokens[temp_i]];
             i = temp_i;
        } else {
            i = temp_i - 1;
        }
        results.push({ raw: numberWordSequence, value, type: 'number', unit, span: [start, start + numberWordSequence.length]});
    }
  }

  // 3. Find digit-based numbers
  const digitRegex = /(\d+\.?\d*)/g;
  while ((match = digitRegex.exec(processedText)) !== null) {
      results.push({ raw: match[0], value: parseFloat(match[0]), type: 'number', unit: null, span: [match.index, match.index + match[0].length] });
  }

  // Final sort by position
  return results.sort((a, b) => a.span[0] - b.span[0]);
}
