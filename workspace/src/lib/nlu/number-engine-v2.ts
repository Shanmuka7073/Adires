/**
 * @fileOverview Simplified Number Engine (Purged).
 */

export interface ParsedNumber {
  raw: string;
  value: number;
  type: "number" | "quantity" | "fraction";
  unit?: string | null;
  span: [number, number];
}

export function extractNumbers(text: string): ParsedNumber[] {
  // Logic removed to reduce bundle weight.
  return [];
}
