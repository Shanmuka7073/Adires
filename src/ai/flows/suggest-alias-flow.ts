
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


// 1. Define the Prompt (this must stay defined explicitly)
const suggestAliasPrompt = ai.definePrompt({
  name: 'suggestAliasPrompt',
  model: 'gemini-1.5-flash',
  input: { schema: AliasTargetSuggestionInputSchema },
  output: { schema: AliasTargetSuggestionOutputSchema },
  prompt: `You are an expert linguistic mapping assistant for an Indian grocery voice command system. Your task is to accurately map a user's failed voice command to the correct item (product, command, or store).

  You will be given:
  1. The user's failed voice command.
  2. The detected language of the command.
  3. A comprehensive list of all possible target items, each with a unique 'key', a 'display' name in English, and a list of its own known aliases.

  **Core Instructions:**
  1.  **Find the Most Probable Match:** Analyze the user's command and find the single most likely target item from the list. Your goal is to find the correct mapping.
  2.  **Use Context:** Consider the language and check if the user's command is a common misspelling, a regional term, or a close phonetic match to any target or its existing aliases.
  3.  **Avoid Gross Errors:** While phonetic matching is useful, avoid obvious mistakes. For example, a user saying "allagadda" (which can mean ginger or potato in Telugu) should NOT be mapped to "ulligadda" (onions). Use semantic common sense.
  4.  **When in Doubt, Abstain:** If the command is ambiguous or does not closely match any target, it is better to return an undefined \`suggestedTargetKey\`. A wrong mapping is worse than no mapping.

  **Context for your task:**
  - User's language: {{{language}}}
  - The command that failed was: "{{{failedCommand}}}"

  **Possible Target Items:**
  {{#each possibleTargets}}
  - Key: {{this.key}}, Display Name: "{{this.display}}", Known Aliases: [{{#each this.aliases}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]
  {{/each}}

  Based on your analysis, identify the single most likely target 'key' from the provided list. Return ONLY the JSON object with the 'suggestedTargetKey' field. If no probable match is found, return a JSON object where the 'suggestedTargetKey' field is explicitly undefined.
  `,
});

// 2. Define the flow logic directly within the exported function
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

// 3. Export the Server Action wrapper function which calls the defined flow
export async function suggestAliasTarget(input: AliasTargetSuggestionInput): Promise<AliasTargetSuggestionOutput> {
  // Directly call the flow instance here
  return suggestAliasTargetFlow(input);
}





