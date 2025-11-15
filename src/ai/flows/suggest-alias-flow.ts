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

const suggestAliasPrompt = ai.definePrompt({
  name: 'suggestAliasPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: AliasTargetSuggestionInputSchema },
  output: { schema: AliasTargetSuggestionOutputSchema },
  prompt: `You are an expert linguistic mapping assistant for an Indian grocery voice command system. Your task is to accurately map a user's failed voice command to the correct item (product, command, or store).

  You are provided with:
  1. The user's failed command.
  2. The detected language of the command.
  3. A list of all possible target items, each with a unique 'key', a 'display' name in English, and a list of its own known aliases.

  **CRITICAL INSTRUCTIONS:**
  1.  **High Confidence Only:** You MUST only return a \`suggestedTargetKey\` if you are highly confident in the match. If there is any ambiguity, or if the command could refer to multiple items, it is better to return an undefined \`suggestedTargetKey\`.
  2.  **Do Not Guess:** If the failed command does not closely match any target or its known aliases, do not attempt to find a "best fit". A wrong mapping is worse than no mapping. 
  3.  **NEGATIVE EXAMPLE:** A user saying "allagadda" (which can mean ginger or potato in Telugu) should NOT be mapped to "ulligadda" (onions), even though they sound similar. This is a critical error. You MUST avoid these kinds of phonetic-only guesses.
  4.  **POSITIVE EXAMPLE:** A user saying "venkaya" (a word for brinjal/eggplant) should be correctly mapped to "brinjal-eggplant". Another example: "allu" should be mapped to "potatoes".
  5.  **Prioritize Known Aliases:** Your primary method for matching should be to see if the user's command is present in the list of known aliases for any of the targets. This is the most reliable signal.

  Here is the context for your task:
  - User's language: {{{language}}}
  - The command that failed was: "{{{failedCommand}}}"

  Here is a list of all possible items they could have meant. Each has a 'key', a 'display' name, and its own 'aliases'.
  {{#each possibleTargets}}
  - Key: {{this.key}}, Display Name: "{{this.display}}", Known Aliases: [{{#each this.aliases}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]
  {{/each}}

  Based on your analysis and the critical instructions above, identify the single most likely target 'key' from the provided list. Return ONLY the JSON object with the 'suggestedTargetKey' field. If no high-confidence match is found, return a JSON object with the 'suggestedTargetKey' field being explicitly undefined.
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

export async function suggestAliasTarget(input: AliasTargetSuggestionInput): Promise<AliasTargetSuggestionOutput> {
  return suggestAliasTargetFlow(input);
}
