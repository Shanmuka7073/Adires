
'use server';
/**
 * @fileOverview An AI flow to extract potential product aliases from a block of text.
 *
 * - extractAliasesFromText - A function that analyzes text and suggests new voice aliases for existing products.
 * - ExtractAliasesInput - The input type for the flow.
 * - ExtractAliasesOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const ExtractAliasesInputSchema = z.object({
  textBlock: z.string().describe('A block of text to analyze for product aliases (e.g., from a book, article, or recipe).'),
  targetProduct: z.string().describe('The canonical product name we are looking for aliases for (e.g., "Aloo Gobi").'),
});
export type ExtractAliasesInput = z.infer<typeof ExtractAliasesInputSchema>;

const ExtractAliasesOutputSchema = z.object({
  en: z.array(z.string()).describe('English synonyms found.'),
  te: z.array(z.string()).describe('Telugu synonyms or transliterations found.'),
  hi: z.array(z.string()).describe('Hindi synonyms or transliterations found.'),
});
export type ExtractAliasesOutput = z.infer<typeof ExtractAliasesOutputSchema>;

export async function extractAliasesFromText(input: ExtractAliasesInput): Promise<ExtractAliasesOutput> {
  const { output } = await ai.generate({
    model: googleAI.model('gemini-2.0-flash'),
    input: {
      schema: ExtractAliasesInputSchema,
      data: input,
    },
    output: {
      schema: ExtractAliasesOutputSchema,
    },
    prompt: `You are a linguistic expert. Read the following text and find ALL possible synonyms, regional names, slang, or common misspellings used for the product: "{{targetProduct}}".
    
    Text to analyze:
    "{{textBlock}}"
    
    Return the unique aliases grouped by English, Telugu, and Hindi. Include both native scripts and Roman transliterations.`,
  });

  return output || { en: [], te: [], hi: [] };
}
