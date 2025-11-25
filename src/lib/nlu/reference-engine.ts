// src/lib/nlu/reference-engine.ts
// Reference / positional / attribute engine
import refWords from './ref-words.json';

type Lang = 'en' | 'te' | 'hi';
type PositionResult = { kind: 'position'; index: number | 'next' | 'prev' | 'mid' | 'last'; raw: string; lang: Lang };
type AttributeResult = { kind: 'attribute'; key: string; raw: string };
type DeicticResult = { kind: 'deictic'; value: 'THIS' | 'THAT'; raw: string; lang: Lang };

export function parsePositionWord(word: string, lang: Lang = 'en'): PositionResult | null {
  const w = word.toLowerCase();
  const pset = (refWords.position as any)[lang] || {};
  if (pset[w] !== undefined) {
    const v = pset[w];
    if (typeof v === 'number') return { kind: 'position', index: v, raw: word, lang };
    return { kind: 'position', index: v as any, raw: word, lang };
  }
  return null;
}

export function findPositionInPhrase(tokens: string[], lang: Lang = 'en'): PositionResult | null {
  for (let i = 0; i < tokens.length; i++) {
    const t = parsePositionWord(tokens[i], lang);
    if (t) return t;
  }
  // also allow numeric ordinal ("1st","2nd","third")
  for (let i = 0; i < tokens.length; i++) {
    const m = tokens[i].match(/^(\d+)(st|nd|rd|th)?$/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (!isNaN(idx)) return { kind: 'position', index: idx, raw: tokens[i], lang };
    }
  }
  return null;
}

export function parseAttributeWord(word: string): AttributeResult | null {
  const key = (refWords.attributes as any)[word.toLowerCase()];
  if (key) return { kind: 'attribute', key, raw: word };
  return null;
}

export function parseDeicticWord(word: string, lang: Lang = 'en'): DeicticResult | null {
  const set = (refWords.deictic as any)[lang] || {};
  const v = set[word.toLowerCase()];
  if (v) return { kind: 'deictic', value: v as 'THIS'|'THAT', raw: word, lang };
  return null;
}

export function resolvePositionToIndex(position: PositionResult, listLength: number): number {
  if (typeof position.index === 'number') {
    const idx = position.index;
    if (idx < 0) return Math.max(0, listLength + idx);
    return Math.min(Math.max(0, idx), listLength - 1);
  }
  if (position.index === 'last') return Math.max(0, listLength - 1);
  if (position.index === 'next') return 0; // default for 'next' as start placeholder
  if (position.index === 'prev') return Math.max(0, listLength - 1);
  if (position.index === 'mid') return Math.floor(listLength / 2);
  return 0;
}
