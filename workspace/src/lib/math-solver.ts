
// math-solver.ts
// Lightweight, safe math evaluator for simple expressions.
// Supports + - * / ^ and parentheses. NO eval() used.

export function safeEvaluate(expression: string): number | null {
  // sanitize allowed chars
  const clean = expression.replace(/[^0-9\.\+\-\*\/\^\%\(\)\s]/g, '');
  // replace ^ with **
  const jsExpr = clean.replace(/\^/g, '**').replace(/%/g, '/100');
  try {
    // Use Function constructor but ensure only numbers/operators remain
    // Extra safety: validate pattern after replacements
    if (!/^[0-9\.\+\-\*\/\*\*\s\(\)]+$/.test(jsExpr)) return null;
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${jsExpr});`);
    const res = fn();
    if (typeof res === 'number' && Number.isFinite(res)) return res;
    return null;
  } catch (e) {
    return null;
  }
}
