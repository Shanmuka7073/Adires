'use server';
/**
 * @fileOverview An AI flow that suggests a corrected target (product or command)
 * for a failed voice command.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the input schema for the AI flow
const SuggestionInputSchema = z.object({
  failedCommand: z.string().describe('The voice command that the user spoke, which the system failed to understand.'),
  possibleTargets: z.array(z.string()).describe('A list of all valid product names and general command names that the user could have intended to say.'),
});

// Define the output schema for the AI flow
const SuggestionOutputSchema = z.object({
  suggestedTarget: z.string().describe('The most likely product or command name from the provided list that matches the user\'s intent. If no reasonable match is found, this should be an empty string.'),
  confidence: z.number().describe('A score from 0.0 to 1.0 indicating the AI\'s confidence in the suggestion.'),
});

// Define the main prompt for the AI model
const suggestionPrompt = ai.definePrompt({
  name: 'aliasSuggestionPrompt',
  input: { schema: SuggestionInputSchema },
  output: { schema: SuggestionOutputSchema },
  prompt: `
    You are an intelligent assistant for a grocery app. Your task is to figure out what the user most likely meant to say.
    A user spoke the command: "{{failedCommand}}"
    It failed because I could not match it to any known product or action.

    Here is a list of all possible valid items they could have been trying to say:
    {{#each possibleTargets}}
    - {{{this}}}
    {{/each}}

    Analyze the user's command and determine the most likely item from the provided list.
    - If you find a very likely match (e.g., "tomotos" vs "Tomatoes"), return it as 'suggestedTarget' with a high confidence score (e.g., 0.9).
    - If the match is plausible but not certain (e.g., "bring me water" vs "Watermelon"), return it with a medium confidence score (e.g., 0.6).
    - If you cannot find any reasonable match in the list, return an empty string for 'suggestedTarget' and a confidence score of 0.0.
  `,
});

/**
 * The server-side flow that calls the AI model to get a suggestion.
 */
const suggestAliasTargetFlow = ai.defineFlow(
  {
    name: 'suggestAliasTargetFlow',
    inputSchema: SuggestionInputSchema,
    outputSchema: SuggestionOutputSchema,
  },
  async (input) => {
    const { output } = await suggestionPrompt(input);
    return output!;
  }
);

/**
 * The exported server action that will be called from the client.
 */
export async function suggestAliasTarget(
  input: z.infer<typeof SuggestionInputSchema>
): Promise<z.infer<typeof SuggestionOutputSchema>> {
  return suggestAliasTargetFlow(input);
}
