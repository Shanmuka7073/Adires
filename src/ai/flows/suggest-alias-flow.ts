
'use server';
/**
 * @fileOverview An AI flow to suggest the correct target for a failed voice command.
 */
import { ai } from '@/ai/genkit';
import {
  AliasTargetSuggestionInputSchema,
  AliasTargetSuggestionOutputSchema,
  type AliasTargetSuggestionInput,
  type AliasTargetSuggestionOutput,
} from './schemas';

export async function suggestAliasTarget(input: AliasTargetSuggestionInput): Promise<AliasTargetSuggestionOutput> {
  return suggestAliasTargetFlow(input);
}

const suggestAliasPrompt = ai.definePrompt({
  name: 'suggestAliasPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: AliasTargetSuggestionInputSchema },
  output: { schema: AliasTargetSuggestionOutputSchema },
  prompt: `You are an intelligent mapping assistant for a grocery voice command system. Your job is to determine the correct item a user intended to say based on their failed command.

  User's language: {{{language}}}
  The command that failed was: "{{{failedCommand}}}"

  Here is a list of all possible items they could have meant. Each has a 'key' and a 'display' name.
  {{#each possibleTargets}}
  - Key: {{this.key}}, Display Name: "{{this.display}}"
  {{/each}}

  Analyze the failed command. Consider the language, common misspellings, synonyms, and phonetic similarities.
  
  Your task:
  Identify the single most likely target 'key' from the provided list.
  If the failed command is "ullipayalu" and one of the targets has the display name "Onions" and the key "onions", you should identify "onions" as the suggestedTargetKey.
  If there is no reasonably close match in the list, you MUST return an undefined 'suggestedTargetKey'. Do not guess.
  
  Return ONLY the JSON object with the 'suggestedTargetKey' field.
  `,
});

const suggestAliasTargetFlow = ai.defineFlow(
  {
    name: 'suggestAliasTargetFlow',
    inputSchema: AliasTargetSuggestionInputSchema,
    outputSchema: AliasTargetSuggestionOutputSchema,
  },
  async (input) => {
    const { output } = await suggestAliasPrompt(input);
    if (!output) {
      return { suggestedTargetKey: undefined };
    }
    return output;
  }
);
