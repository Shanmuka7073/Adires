
'use server';
/**
 * @fileOverview An AI flow to suggest corrections for failed voice commands.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the input schema for the flow
const AliasTargetSuggestionInputSchema = z.object({
  commandText: z.string().describe('The full text of the failed voice command.'),
  language: z.string().describe("The detected language of the command (e.g., 'en', 'te')."),
  validProducts: z.array(z.string()).describe('A list of all valid product names.'),
  validCommands: z.array(z.string()).describe('A list of all valid general command keys (e.g., "go-to-cart").'),
  validStores: z.array(z.string()).describe('A list of all valid store names.'),
});
export type AliasTargetSuggestionInput = z.infer<typeof AliasTargetSuggestionInputSchema>;

// Define the output schema for the flow
const AliasTargetSuggestionOutputSchema = z.object({
  reasoning: z.string().describe("A brief explanation of why the command failed and the logic behind the suggestion."),
  suggestedTargetKey: z.string().optional().describe("The suggested canonical key (product name, command key, or store name) that the user might have intended. Should be an exact match from one of the provided valid lists."),
  suggestedAlias: z.string().optional().describe("A new, normalized alias that could be added to the system to recognize this command in the future."),
});
export type AliasTargetSuggestionOutput = z.infer<typeof AliasTargetSuggestionOutputSchema>;

// Define the prompt for the AI
const suggestAliasTargetPrompt = ai.definePrompt({
  name: 'suggestAliasTargetPrompt',
  input: { schema: AliasTargetSuggestionInputSchema },
  output: { schema: AliasTargetSuggestionOutputSchema },
  prompt: `You are an expert linguist and data analyst for a voice-controlled grocery app. Your task is to analyze a failed voice command and determine what the user likely meant.

Analyze the user's command: "{{commandText}}" (spoken in language: {{language}}).

Here are the lists of valid items in our system:
- Valid Commands: {{#each validCommands}} "{{this}}"{{#unless @last}}, {{/unless}}{{/each}}
- Valid Products: {{#each validProducts}} "{{this}}"{{#unless @last}}, {{/unless}}{{/each}}
- Valid Stores: {{#each validStores}} "{{this}}"{{#unless @last}}, {{/unless}}{{/each}}

Based on the user's text and the valid items, provide a structured analysis.
1.  **Reasoning**: Briefly explain why the command failed. Was it a misspelling, slang, or an unknown term?
2.  **suggestedTargetKey**: If you can confidently match the user's intent to one of the valid items, provide the exact key here. If there is no confident match, leave this field empty.
3.  **suggestedAlias**: If you identified a new way a user might refer to an item, suggest a new, clean, lowercase alias for it. For example, if the user said "tomotoes," the suggested alias could be "tomoto". If no new alias is logical, leave this empty.
`,
});

// Define the main flow
const suggestAliasTargetFlow = ai.defineFlow(
  {
    name: 'suggestAliasTargetFlow',
    inputSchema: AliasTargetSuggestionInputSchema,
    outputSchema: AliasTargetSuggestionOutputSchema,
  },
  async (input) => {
    const { output } = await suggestAliasTargetPrompt(input);
    return output!;
  }
);

// Create and export the async wrapper function
export async function suggestAliasTarget(input: AliasTargetSuggestionInput): Promise<AliasTargetSuggestionOutput> {
  return suggestAliasTargetFlow(input);
}
