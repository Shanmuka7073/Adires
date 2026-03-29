
'use server';
/**
 * @fileOverview An AI flow to suggest multilingual aliases for a number.
 *
 * - suggestNumberAliases - A function that suggests aliases for a number.
 * - SuggestNumberAliasesInput - The input type for the flow.
 * - SuggestNumberAliasesOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const SuggestNumberAliasesInputSchema = z.object({
  number: z.string().describe('The cardinal number (e.g., "1", "25").'),
  name: z.string().describe('The English word for the number (e.g., "one", "twenty-five").'),
});
export type SuggestNumberAliasesInput = z.infer<typeof SuggestNumberAliasesInputSchema>;

const AliasesSchema = z.object({
    en: z.array(z.string()).describe("A list of common English aliases and misspellings."),
    te: z.array(z.string()).describe("A list of common Telugu aliases, including both native script and their Roman script transliterations."),
    hi: z.array(z.string()).describe("A list of common Hindi aliases, including both Devanagari script and their Roman script transliterations."),
});

const SuggestNumberAliasesOutputSchema = z.object({
  aliases: AliasesSchema.describe("The suggested aliases for the number in different languages."),
});
export type SuggestNumberAliasesOutput = z.infer<typeof SuggestNumberAliasesOutputSchema>;

export async function suggestNumberAliases(input: SuggestNumberAliasesInput): Promise<SuggestNumberAliasesOutput> {
  return suggestNumberAliasesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestNumberAliasesPrompt',
  input: {schema: SuggestNumberAliasesInputSchema},
  output: {schema: SuggestNumberAliasesOutputSchema},
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are a linguistic expert for a voice-controlled app in India. Your task is to generate common aliases for the number {{number}} ({{name}}).

Generate common ways people might say or spell this number.

1.  **te (Telugu)**: Provide the Telugu word in its native script (e.g., 'ఒకటి') AND its common Roman script transliterations (e.g., 'okati', 'oka').
2.  **hi (Hindi)**: Provide the Hindi word in Devanagari script (e.g., 'एक') AND its common Roman script transliteration (e.g., 'ek').
3.  **en (English)**: Provide common misspellings or alternative phrasings for the English word. Include the Roman transliterations from Telugu and Hindi here as well.

Keep the lists concise and focused on the most common terms.
`,
});

const suggestNumberAliasesFlow = ai.defineFlow(
  {
    name: 'suggestNumberAliasesFlow',
    inputSchema: SuggestNumberAliasesInputSchema,
    outputSchema: SuggestNumberAliasesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
