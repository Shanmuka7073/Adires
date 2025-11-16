'use server';
/**
 * @fileOverview An AI flow to suggest aliases for failed voice commands.
 *
 * - suggestAlias - A function that suggests a new voice alias for a failed command.
 * - SuggestAliasInput - The input type for the suggestAlias function.
 * - SuggestAliasOutput - The return type for the suggestAlias function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestAliasInputSchema = z.object({
  commandText: z.string().describe('The failed voice command text that the user spoke.'),
  language: z.string().describe("The language of the command (e.g., 'en', 'te')."),
  itemNames: z.array(z.string()).describe('A list of all valid item names (products and stores) that the command could have been referring to.'),
});
export type SuggestAliasInput = z.infer<typeof SuggestAliasInputSchema>;

const SuggestAliasOutputSchema = z.object({
  isSuggestionAvailable: z
    .boolean()
    .describe('Whether a confident suggestion could be made.'),
  suggestedKey: z
    .string()
    .describe(
      'The canonical key of the item that is the most likely match (e.g., "tomatoes").'
    ),
  suggestedAlias: z
    .string()
    .describe('The new alias that should be created for the key, which is the original command text.'),
  reasoning: z
    .string()
    <changes>
  <description>Adds a Genkit AI flow to suggest fixes for failed voice commands and integrates it into the admin dashboard. This allows an admin to use AI to improve voice recognition accuracy.</description>
  <change>
    <file>/src/ai/flows/suggest-alias-flow.ts</file>
    <content><![CDATA['use server';
/**
 * @fileOverview An AI flow to suggest aliases for failed voice commands.
 *
 * - suggestAlias - A function that suggests a new voice alias for a failed command.
 * - SuggestAliasInput - The input type for the suggestAlias function.
 * - SuggestAliasOutput - The return type for the suggestAlias function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestAliasInputSchema = z.object({
  commandText: z.string().describe('The failed voice command text that the user spoke.'),
  language: z.string().describe("The language of the command (e.g., 'en', 'te')."),
  itemNames: z.array(z.string()).describe('A list of all valid item names (products and stores) that the command could have been referring to.'),
});
export type SuggestAliasInput = z.infer<typeof SuggestAliasInputSchema>;

const SuggestAliasOutputSchema = z.object({
  isSuggestionAvailable: z
    .boolean()
    .describe('Whether a confident suggestion could be made.'),
  suggestedKey: z
    .string()
    .describe(
      'The canonical key of the item that is the most likely match (e.g., "tomatoes").'
    ),
  suggestedAlias: z
    .string()
    .describe('The new alias that should be created for the key, which is the original command text.'),
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
  prompt: `You are an expert linguist and data analyst for a grocery app. Your task is to analyze a failed voice command and determine if it was a misspelling or an alternate name for an existing item.

The user said: "{{commandText}}" in language "{{language}}".

The system failed to understand it. Your goal is to find the most likely intended item from the provided list.

Here are all the valid item names:
{{#each itemNames}}
- {{this}}
{{/each}}

Analyze the user's command "{{commandText}}". Compare it against the list of valid item names. Consider common misspellings, phonetic similarities, and regional variations.

If you find a match with a high degree of confidence (e.g., "tamato" for "tomatoes"), set 'isSuggestionAvailable' to true.
Then, set 'suggestedKey' to the correct canonical item name (e.g., "tomatoes").
Set 'suggestedAlias' to the original failed command text ("{{commandText}}").
Provide a brief 'reasoning' for your choice.

If you are not confident, or if it seems like a completely new item or a complex command, set 'isSuggestionAvailable' to false and leave the other fields blank.
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
