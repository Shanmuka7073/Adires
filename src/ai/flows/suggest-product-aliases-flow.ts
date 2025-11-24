
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
    en: z.array(z.string()).describe("A list of common English aliases, including singular, plural forms, and the Roman-script transliterations from Telugu and Hindi."),
    te: z.array(z.string()).describe("A list of common Telugu aliases, including both native script (e.g., 'ఉల్లిపాయలు') and their Roman script transliterations (e.g., 'ullipayalu', 'erragadda')."),
    hi: z.array(z.string()).describe("A list of common Hindi aliases, including both Devanagari script (e.g., 'प्याज') and their Roman script transliterations (e.g., 'pyaaz')."),
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
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are a linguistic expert for an Indian grocery app. Your task is to generate common aliases for a given product in multiple languages, their native scripts, and their English transliterations.

For the product: "{{productName}}"

Generate a list of common aliases, including colloquialisms, common misspellings, and transliterations.

Provide the following:
1.  **te (Telugu)**: A list of common names in Telugu. CRUCIALLY, include both the native Telugu script (e.g., 'ఉల్లిపాయలు') AND their common English letter transliterations (e.g., 'ullipayalu', 'erragadda').
2.  **hi (Hindi)**: A list of common names in Hindi. CRUCIALLY, you MUST include both the native Devanagari script (e.g., 'प्याज') AND their common English letter transliterations (e.g., 'pyaaz', 'gajar'). This is a strict requirement.
3.  **en (English)**: A list of common English names. Include singular and plural forms. IMPORTANT: You MUST also include all the Roman-script (English letter) transliterations from the 'te' and 'hi' lists here in the 'en' list as well.

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
