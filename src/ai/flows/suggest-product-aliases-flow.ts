
'use server';
/**
 * @fileOverview An AI flow to suggest multilingual aliases for a product name.
 *
 * - suggestProductAliases - A function that suggests aliases.
 * - SuggestProductAliasesInput - The input type for the flow.
 * - SuggestProductAliasesOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const SuggestProductAliasesInputSchema = z.object({
  productName: z.string().describe('The canonical English name of the grocery product.'),
});
export type SuggestProductAliasesInput = z.infer<typeof SuggestProductAliasesInputSchema>;

const AliasesSchema = z.object({
    en: z.array(z.string()).describe("A list of common English aliases, including singular and plural forms."),
    te: z.array(z.string()).describe("A list of common Telugu aliases, written in Telugu script."),
    hi: z.array(z.string()).describe("A list of common Hindi aliases, written in Devanagari script."),
});

const SuggestProductAliasesOutputSchema = z.object({
  aliases: AliasesSchema.describe("The suggested aliases for the product in different languages."),
});
export type SuggestProductAliasesOutput = z.infer<typeof SuggestProductAliasesOutputSchema>;

export async function suggestProductAliases(input: SuggestProductAliasesInput): Promise<SuggestProductAliasesOutput> {
  return suggestProductAliasesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestProductAliasesPrompt',
  input: {schema: SuggestProductAliasesInputSchema},
  output: {schema: SuggestProductAliasesOutputSchema},
  model: googleAI.model('gemini-1.5-flash'),
  prompt: `You are a linguistic expert for an Indian grocery app. Your task is to generate common aliases for a given product in multiple languages and their scripts.

For the product: "{{productName}}"

Generate a list of common aliases, including colloquialisms, common misspellings, and transliterations (e.g., "pyaaz" for onions).

Provide the following:
1.  **en (English)**: A list of common English names. Include singular and plural forms.
2.  **te (Telugu)**: A list of common names in Telugu script and their English transliterations (e.g., 'ఉల్లిపాయలు', 'ullipayalu', 'erragadda').
3.  **hi (Hindi)**: A list of common names in Devanagari script and their English transliterations (e.g., 'प्याज', 'pyaaz').

Keep the lists concise and focused on the most common terms.
`,
});

const suggestProductAliasesFlow = ai.defineFlow(
  {
    name: 'suggestProductAliasesFlow',
    inputSchema: SuggestProductAliasesInputSchema,
    outputSchema: SuggestProductAliasesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
