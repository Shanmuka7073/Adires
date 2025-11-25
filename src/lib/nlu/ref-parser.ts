// High level phrase parser that extracts positional/attribute/deictic references from a phrase
import { findPositionInPhrase, parseAttributeWord, parseDeicticWord, resolvePositionToIndex } from './reference-engine';

export type Lang = 'en'|'te'|'hi';
export type RefParse = {
  positions: Array<{ token: string; posIdx: number | string }>;
  attributes: Array<{ token: string; key: string }>;
  deictic?: { token: string; value: 'THIS'|'THAT' };
  clearedTokens: string[]; // tokens after removing ref tokens
};

export function parseRefsFromText(text: string, lang: Lang = 'en', listLength = 0): RefParse {
  const tokens = text.split(/\s+/).filter(Boolean);
  const positions: Array<{ token: string; posIdx: number | string }> = [];
  const attributes: Array<{ token: string; key: string }> = [];
  let deictic: { token: string; value: 'THIS'|'THAT' } | undefined;

  const cleared: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const pos = findPositionInPhrase([t], lang);
    if (pos) {
      const resolved = typeof pos.index === 'number' ? pos.index : pos.index;
      positions.push({ token: t, posIdx: resolved });
      continue;
    }
    const attr = parseAttributeWord(t);
    if (attr) {
      attributes.push({ token: t, key: attr.key });
      continue;
    }
    const d = parseDeicticWord(t, lang);
    if (d) {
      deictic = { token: t, value: d.value };
      continue;
    }

    // plural/suffixed words like "1st," "2kg", "3kg," -> keep as tokens for number engine
    cleared.push(t);
  }

  // Normalize numeric ordinal tokens in positions array (if numeric string)
  const normalizedPositions = positions.map(p => {
    if (typeof p.posIdx === 'string') return p;
    return p;
  });

  return {
    positions: normalizedPositions,
    attributes,
    deictic,
    clearedTokens: cleared
  };
}

export function resolveParsedRefs(parsed: ReturnType<typeof parseRefsFromText>, listLength: number) {
  const resolvedPositions = parsed.positions.map(p => {
    if (typeof p.posIdx === 'number') {
      return resolvePositionToIndex({ kind: 'position', index: p.posIdx, raw: p.token, lang: 'en' }, listLength);
    }
    if (p.posIdx === 'last') return Math.max(0, listLength - 1);
    if (p.posIdx === 'mid') return Math.floor(listLength / 2);
    if (p.posIdx === 'next') return 0;
    if (p.posIdx === 'prev') return Math.max(0, listLength - 1);
    return 0;
  });

  return { ...parsed, resolvedPositions };
}
