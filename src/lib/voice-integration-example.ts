
// voice-integration-example.ts
// Example: how to use the engine from your VoiceCommander or server endpoint.

import { parseSentenceForNumbers } from './number-meaning-engine';
import { safeEvaluate } from './math-solver';

export type NormalizedAction = {
  type: 'ADD' | 'REMOVE' | 'CHECK_PRICE' | 'MATH' | 'UNKNOWN' | 'SMART_ORDER';
  product?: string;
  quantity?: number;
  unit?: string;
  positionIndex?: number;
  math?: { expression: string; value?: number | null };
  reason?: string;
};

export async function interpretUserSentence(sentence: string): Promise<NormalizedAction> {
  const parsed = parseSentenceForNumbers(sentence);
  // 1) If math detected, solve and return
  if (parsed.mathExpression) {
    const val = safeEvaluate(parsed.mathExpression);
    return {
      type: 'MATH',
      math: { expression: parsed.mathExpression, value: val ?? null }
    };
  }

  // 2) If intent hint indicates add/remove/price
  const hint = parsed.intentHints[0];

  // Find primary product token (very simple heuristic: the last non-number token)
  let productToken = '';
  for (let i = parsed.tokens.length - 1; i >= 0; i--) {
    const t = parsed.tokens[i];
    // skip quantity tokens
    if (parsed.numbers.some(n => n.raw.toLowerCase() === t.toLowerCase())) continue;
    if (/^(add|buy|put|remove|delete|price|cost|how|what|is|the|a|an|to|for|in|on)$/.test(t.toLowerCase())) continue;
    productToken = t;
    break;
  }

  // pick quantity if present
  const qtyNum = parsed.numbers.find(n => n.meaningType === 'quantity' || typeof n.normalizedValue === 'number');
  const position = parsed.numbers.find(n => n.meaningType === 'position');

  const base: NormalizedAction = { type: 'UNKNOWN' };

  if (hint === 'ADD_TO_CART' || /\b(add|buy|put|cart)\b/i.test(sentence)) {
    base.type = 'ADD';
    if (productToken) base.product = productToken;
    if (qtyNum?.normalizedValue != null) base.quantity = qtyNum.normalizedValue;
    if (qtyNum?.unit) base.unit = qtyNum.unit;
    if (position) base.positionIndex = position.positionIndex;
    return base;
  }

  if (hint === 'REMOVE_FROM_CART' || /\b(remove|delete|take out)\b/i.test(sentence)) {
    base.type = 'REMOVE';
    if (productToken) base.product = productToken;
    if (position) base.positionIndex = position.positionIndex;
    return base;
  }

  if (hint === 'CHECK_PRICE' || /\b(price|cost|how much|rate)\b/i.test(sentence)) {
    base.type = 'CHECK_PRICE';
    if (productToken) base.product = productToken;
    return base;
  }

  if (hint === 'SMART_ORDER' || /\b(order)\b/i.test(sentence)) {
    base.type = 'SMART_ORDER';
    base.product = productToken || undefined;
    return base;
  }

  // fallback: if a strong quantity but no action, suggest it's quantity query
  if (qtyNum) {
    base.type = 'UNKNOWN';
    base.quantity = qtyNum.normalizedValue;
    base.unit = qtyNum.unit;
    base.reason = 'detected quantity but no action';
    return base;
  }

  return base;
}
