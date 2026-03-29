
'use server';
/**
 * @fileOverview An AI flow to suggest multilingual aliases and replies for a general voice command.
 *
 * - suggestCommandAliases - A function that suggests aliases and replies.
 * - SuggestCommandAliasesInput - The input type for the flow.
 * - SuggestCommandAliasesOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const SuggestCommandAliasesInputSchema = z.object({
  commandKey: z.string().describe("The unique, code-friendly key for the command (e.g., 'goToHome')."),
  commandDisplay: z.string().describe("The user-facing display name of the command (e.g., 'Go To Home')."),
});
export type SuggestCommandAliasesInput = z.infer<typeof SuggestCommandAliasesInputSchema>;

const AliasesSchema = z.object({
    en: z.array(z.string()).describe("A list of common English aliases, including Roman-script transliterations from Telugu and Hindi."),
    te: z.array(z.string()).describe("A list of common Telugu aliases, including both native script (e.g., 'హోమ్ కి వెళ్ళు') and their Roman script transliterations (e.g., 'home ki vellu')."),
    hi: z.array(z.string()).describe("A list of common Hindi aliases, including both Devanagari script (e.g., 'होम पर जाओ') and their Roman script transliterations (e.g., 'home par jao')."),
});

const RepliesSchema = z.object({
    en: z.array(z.string()).describe("A list of 3-4 creative and conversational replies in English."),
    te: z.array(z.string()).describe("A list of 3-4 creative and conversational replies in Telugu native script."),
    hi: z.array(z.string()).describe("A list of 3-4 creative and conversational replies in Hindi native script."),
});

const SuggestCommandAliasesOutputSchema = z.object({
  aliases: AliasesSchema.describe("The suggested aliases for the command in different languages."),
  replies: RepliesSchema.describe("A list of suggested conversational replies for the app to speak."),
});
export type SuggestCommandAliasesOutput = z.infer<typeof SuggestCommandAliasesOutputSchema>;

export async function suggestCommandAliases(input: SuggestCommandAliasesInput): Promise<SuggestCommandAliasesOutput> {
  return suggestCommandAliasesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCommandAliasesPrompt',
  input: {schema: SuggestCommandAliasesInputSchema},
  output: {schema: SuggestCommandAliasesOutputSchema},
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are a UX writer and linguist for a voice-controlled app in India. Your task is to generate intuitive voice command aliases and conversational replies for a given action.

For the command with the display name: "{{commandDisplay}}"

Part 1: Generate Aliases
Generate a list of common ways a user might say this. Include variations, synonyms, and different phrasing.
1.  **te (Telugu)**: A list of common phrases in Telugu. CRUCIALLY, include both the native Telugu script (e.g., 'హోమ్ కి వెళ్ళు') AND their common English letter transliterations (e.g., 'home ki vellu').
2.  **hi (Hindi)**: A list of common phrases in Hindi. CRUCIALLY, you MUST include both the native Devanagari script (e.g., 'होम पर जाओ') AND their common English letter transliterations (e.g., 'home par jao'). This is a strict requirement.
3.  **en (English)**: A list of common English phrases. IMPORTANT: You MUST also include all the Roman-script (English letter) transliterations from the 'te' and 'hi' lists here in the 'en' list as well.

Part 2: Generate Replies
Generate a list of 3-4 creative, varied, and conversational replies the app could speak in response to the command.
1. **en (English)**: A list of replies in English.
2. **te (Telugu)**: A list of replies in Telugu (native script).
3. **hi (Hindi)**: A list of replies in Hindi (native script).

Keep all lists concise and focused on the most natural and common user commands and replies.
`,
});

const suggestCommandAliasesFlow = ai.defineFlow(
  {
    name: 'suggestCommandAliasesFlow',
    inputSchema: SuggestCommandAliasesInputSchema,
    outputSchema: SuggestCommandAliasesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
