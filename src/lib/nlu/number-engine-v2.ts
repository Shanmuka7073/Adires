import numbers from './numbers.json';

export function parseNumbers(text: string) {
  const tokens = text.toLowerCase().split(/\s+/g);
  const results: any[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];

    if (!isNaN(Number(word))) {
      results.push({
        raw: word,
        normalizedValue: Number(word),
        type: "digit",
        idx: i
      });
      continue;
    }

    if (numbers.english[word] !== undefined) {
      results.push({
        raw: word,
        normalizedValue: numbers.english[word],
        type: "english",
        idx: i
      });
      continue;
    }

    if (numbers.telugu[word] !== undefined) {
      results.push({
        raw: word,
        normalizedValue: numbers.telugu[word],
        type: "telugu",
        idx: i
      });
      continue;
    }

    if (numbers.hindi[word] !== undefined) {
      results.push({
        raw: word,
        normalizedValue: numbers.hindi[word],
        type: "hindi",
        idx: i
      });
      continue;
    }

    if (word.endsWith("kg") || word === "kg") {
      const num = Number(tokens[i - 1]);
      if (!isNaN(num)) {
        results.push({
          raw: `${num}kg`,
          normalizedValue: num,
          unit: "kg",
          type: "unit",
          idx: i - 1
        });
      }
    }

    if (word.endsWith("%")) {
      const n = Number(word.replace("%", ""));
      if (!isNaN(n)) {
        results.push({
          raw: word,
          normalizedValue: n / 100,
          type: "fraction",
          idx: i
        });
      }
    }
  }

  return results;
}