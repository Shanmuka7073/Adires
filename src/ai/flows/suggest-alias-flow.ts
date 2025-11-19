'use server';
/**
 * @fileOverview An AI flow to suggest aliases for failed voice commands and generate multilingual aliases.
 *
 * - suggestAlias - A function that suggests a new voice alias for a failed command.
 * - SuggestAliasInput - The input type for the suggestAlias function.
 * - SuggestAliasOutput - The return type for the suggestAlias function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const SuggestAliasInputSchema = z.object({
  commandText: z.string().describe('The failed voice command text that the user spoke.'),
  language: z.string().describe("The language of the command (e.g., 'en', 'te')."),
  itemNames: z.array(z.string()).describe('A list of all valid item names (products and stores) that the command could have been referring to.'),
});
export type SuggestAliasInput = z.infer<typeof SuggestAliasInputSchema>;

const AliasSuggestionSchema = z.object({
  lang: z.string().describe("The language code for the alias (e.g., 'en', 'te', 'hi')."),
  alias: z.string().describe("The suggested alias in that language's native script (e.g., 'onions', 'ఉల్లిపాయలు', 'प्याज')."),
  transliteratedAlias: z.string().optional().describe("The Roman-script (English letters) transliteration of the alias, if applicable (e.g., 'ullipayalu', 'pyaz')."),
});

const SuggestAliasOutputSchema = z.object({
  isSuggestionAvailable: z
    .boolean()
    .describe('Whether a confident suggestion could be made.'),
  suggestedKey: z
    .string()
    .describe(
      'The canonical key of the item that is the most likely match (e.g., "moong-dal").'
    ),
  originalCommand: z
    .string()
    .describe('The original failed command text, which will also be added as an alias.'),
  suggestedAliases: z
    .array(AliasSuggestionSchema)
    .describe("A list of standard names and transliterations for the suggested item."),
  reasoning: z
    .string()
    .describe(
      'A brief explanation of why this suggestion was made.'
    ),
});
export type SuggestAliasOutput = z.infer<typeof SuggestAliasOutputSchema>;

export async function suggestAlias(input: SuggestAliasInput): Promise<SuggestAliasOutput> {
  return suggestAliasFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestAliasPrompt',
  input: {schema: SuggestAliasInputSchema},
  output: {schema: SuggestAliasOutputSchema},
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are an expert linguist and data analyst for a grocery app in India. Your task is to analyze a failed voice command, find the most likely intended item, and then provide standard aliases for it in multiple languages and scripts.

The user said: "{{commandText}}" in language "{{language}}".

The system failed to understand it. Your goal is to find the most likely intended item from the provided list.

Here are all the valid canonical item names (in English):
{{#each itemNames}}
- {{this}}
{{/each}}

1.  **Analyze and Match**: Analyze the user's command "{{commandText}}". Compare it against the list of valid item names. Consider common misspellings, phonetic similarities (e.g., "pesara pappu" for "Moong Dal"), and regional variations.

2.  **Generate Output**:
    *   If you find a match with a high degree of confidence (e.g., "pesara pappu" for "Moong Dal"), set 'isSuggestionAvailable' to true.
    *   Set 'suggestedKey' to the correct canonical item name's slug (e.g., "moong-dal").
    *   Set 'originalCommand' to the user's input: "{{commandText}}".
    *   For the 'suggestedAliases' array, provide the standard names for the corrected item in three languages. For each language, provide both the native script and the Roman (English) script transliteration.
        *   An object for English (lang: 'en'). The 'alias' should be the English name. 'transliteratedAlias' can be omitted for English.
        *   An object for Telugu (lang: 'te'). The 'alias' should be in Telugu script (e.g., 'ఉల్లిపాయలు'), and the 'transliteratedAlias' should be in Roman script (e.g., 'ullipayalu').
        *   An object for Hindi (lang: 'hi'). The 'alias' should be in Devanagari script (e.g., 'प्याज'), and the 'transliteratedAlias' should be in Roman script (e.g., 'pyaz').
    *   Provide a brief 'reasoning' for your choice.

    *   If you are not confident, or if it seems like a completely new item or a complex command, set 'isSuggestionAvailable' to false and leave the other fields blank.
`,
});

const suggestAliasFlow = ai.defineFlow(
  {
    name: 'suggestAliasFlow',
    inputSchema: SuggestAliasInputSchema,
    outputSchema: SuggestAliasOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
