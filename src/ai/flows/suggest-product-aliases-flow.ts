
'use server';
/**
 * @fileOverview An AI flow to suggest multilingual aliases for a canonical product name.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SuggestProductAliasesInputSchema = z.object({
  productName: z.string().describe('The canonical English name of the item.'),
});
export type SuggestProductAliasesInput = z.infer<typeof SuggestProductAliasesInputSchema>;

const AliasesSchema = z.object({
    en: z.array(z.string()).describe("English synonyms including singular/plural."),
    te: z.array(z.string()).describe("Telugu aliases in native script and Roman transliteration."),
    hi: z.array(z.string()).describe("Hindi aliases in native script and Roman transliteration."),
});

const SuggestProductAliasesOutputSchema = z.object({
  aliases: AliasesSchema.describe("The generated aliases for the item."),
});
export type SuggestProductAliasesOutput = z.infer<typeof SuggestProductAliasesOutputSchema>;

const prompt = ai.definePrompt({
  name: 'suggestProductAliasesPrompt',
  input: { schema: SuggestProductAliasesInputSchema },
  output: { schema: SuggestProductAliasesOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are a linguistic expert for an Indian hyperlocal marketplace.
For the product: "{{productName}}"

Generate a comprehensive list of synonyms, slang, and common misspellings that people in India might use when speaking into a microphone.

Rules:
1. **Telugu**: Include the native script (e.g. 'బిర్యానీ') AND common Roman spelling (e.g. 'biryani', 'briyani').
2. **Hindi**: Include native script (e.g. 'बिरयानी') AND common Roman spelling.
3. **English**: Include common misspellings or variants.
4. **Context**: Focus on South Indian contexts if applicable (especially Telugu/Andhra style).

Return a valid JSON with three arrays: 'en', 'te', 'hi'.`,
});

export async function suggestProductAliases(input: SuggestProductAliasesInput): Promise<SuggestProductAliasesOutput> {
  const { output } = await prompt(input);
  return output!;
}
