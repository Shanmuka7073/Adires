
'use server';
/**
 * @fileOverview An AI flow to generate multilingual aliases for all numbers from 1 to 100.
 *
 * - generateAllNumberAliases - A function that generates a complete set of number aliases.
 * - GenerateAllNumberAliasesOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SingleNumberAliasesSchema = z.object({
  en: z.array(z.string()),
  te: z.array(z.string()),
  hi: z.array(z.string()),
});

const GenerateAllNumberAliasesOutputSchema = z.object({
  allAliases: z.record(z.string(), SingleNumberAliasesSchema).describe("An object where keys are 'number-X' (e.g., 'number-1', 'number-25') and values are the alias objects for that number."),
});
export type GenerateAllNumberAliasesOutput = z.infer<typeof GenerateAllNumberAliasesOutputSchema>;

export async function generateAllNumberAliases(): Promise<GenerateAllNumberAliasesOutput> {
  return generateAllNumberAliasesFlow();
}

const prompt = ai.definePrompt({
  name: 'generateAllNumberAliasesPrompt',
  output: { schema: GenerateAllNumberAliasesOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are a linguistic expert for a voice-controlled app in India. Your task is to generate a comprehensive list of common aliases for all numbers from 1 to 100.

For EACH number from 1 to 100, generate a list of common ways people might say or spell it.

The output must be a single JSON object where each key is a string in the format "number-X" (e.g., "number-1", "number-25", "number-100").
The value for each key must be an object with three properties: 'en', 'te', and 'hi'.

For each language property, provide an array of strings:
1.  **te (Telugu)**: Provide the Telugu word in its native script (e.g., 'ఒకటి') AND its common Roman script transliterations (e.g., 'okati', 'oka'). Include common variations.
2.  **hi (Hindi)**: Provide the Hindi word in Devanagari script (e.g., 'एक') AND its common Roman script transliteration (e.g., 'ek').
3.  **en (English)**: Provide common misspellings or alternative phrasings for the English word (e.g., for 'one', include 'won'). Also include all the Roman transliterations from the 'te' and 'hi' lists here in the 'en' list as well. This is critical for mixed-language understanding.

Example for the number 1:
"number-1": {
  "en": ["one", "won", "okati", "oka", "ek"],
  "te": ["ఒకటి", "okati", "ఒక", "oka"],
  "hi": ["एक", "ek"]
}

Generate this structure for all numbers from 1 to 100.
`,
});

const generateAllNumberAliasesFlow = ai.defineFlow(
  {
    name: 'generateAllNumberAliasesFlow',
    outputSchema: GenerateAllNumberAliasesOutputSchema,
  },
  async () => {
    const { output } = await prompt();
    return output!;
  }
);
