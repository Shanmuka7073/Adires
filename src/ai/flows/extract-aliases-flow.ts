'use server';
/**
 * @fileOverview An AI flow to extract synonyms and aliases for a product from a block of text.
 * Optimized for marketplace expansion and multilingual support.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractAliasesInputSchema = z.object({
  textBlock: z.string().describe('The block of text to analyze for aliases.'),
  targetProduct: z.string().describe('The canonical product name to match against.'),
});
export type ExtractAliasesInput = z.infer<typeof ExtractAliasesInputSchema>;

const ExtractAliasesOutputSchema = z.object({
  en: z.array(z.string()).describe('English synonyms found.'),
  te: z.array(z.string()).describe('Telugu synonyms found (native or Roman).'),
  hi: z.array(z.string()).describe('Hindi synonyms found (native or Roman).'),
});
export type ExtractAliasesOutput = z.infer<typeof ExtractAliasesOutputSchema>;

const aliasPrompt = ai.definePrompt({
  name: 'extractAliasesPrompt',
  input: { schema: ExtractAliasesInputSchema },
  output: { schema: ExtractAliasesOutputSchema },
  model: 'googleai/gemini-1.5-flash',
  prompt: `You are an expert linguist for an Indian marketplace.
Extract every possible nickname, slang term, misspelling, or synonym for the product "{{targetProduct}}" from the text below.

Text Block:
"""
{{textBlock}}
"""

Categorize the results into English (en), Telugu (te), and Hindi (hi). 
For Telugu and Hindi, include both native script and Roman transliterations if found.
Return as structured JSON.`,
});

export async function extractAliasesFromText(input: ExtractAliasesInput): Promise<ExtractAliasesOutput> {
  const { output } = await aliasPrompt(input);
  return output || { en: [], te: [], hi: [] };
}
