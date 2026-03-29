'use server';
/**
 * @fileOverview An AI flow to suggest localized voice replies in a Kurnool dialect.
 *
 * - suggestLocalReplies - A function that suggests dialect-specific replies.
 * - SuggestLocalRepliesInput - The input type for the flow.
 * - SuggestLocalRepliesOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const SuggestLocalRepliesInputSchema = z.object({
  commandDisplay: z.string().describe("The user-facing display name of the command (e.g., 'Add Item to Cart')."),
  englishReply: z.string().describe('The current standard English reply.'),
  teluguReply: z.string().describe('The current standard Telugu reply.'),
  hindiReply: z.string().describe('The current standard Hindi reply.'),
});
export type SuggestLocalRepliesInput = z.infer<typeof SuggestLocalRepliesInputSchema>;

const SuggestLocalRepliesOutputSchema = z.object({
  english: z.string().describe("The suggested reply in Kurnool-style English (e.g., mixing in Telugu words)."),
  telugu: z.string().describe("The suggested reply in Kurnool/Rayalaseema dialect Telugu."),
  hindi: z.string().describe("The suggested reply in Hindi with a South Indian/Kurnool accent and style."),
});
export type SuggestLocalRepliesOutput = z.infer<typeof SuggestLocalRepliesOutputSchema>;

export async function suggestLocalReplies(input: SuggestLocalRepliesInput): Promise<SuggestLocalRepliesOutput> {
  return suggestLocalRepliesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestLocalRepliesPrompt',
  input: {schema: SuggestLocalRepliesInputSchema},
  output: {schema: SuggestLocalRepliesOutputSchema},
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are a linguistic expert specializing in Indian regional dialects. Your task is to rewrite the following standard replies into the specific dialect of **Kurnool, Rayalaseema region, Andhra Pradesh**.

The command is for: "{{commandDisplay}}"

Rewrite the following replies. The placeholders like {productName} must be kept exactly as they are.

1.  **Kurnool English:** Rewrite the standard English reply: "{{englishReply}}". Make it sound natural, like how someone from Kurnool would speak English, perhaps mixing in a common Telugu word.
2.  **Kurnool Telugu:** Rewrite the standard Telugu reply: "{{teluguReply}}". Use the Rayalaseema dialect and slang common in Kurnool.
3.  **Kurnool Hindi:** Rewrite the standard Hindi reply: "{{hindiReply}}". Make it sound like how a South Indian from the Kurnool region would speak Hindi.

Provide only the rewritten text for each language.`,
});

const suggestLocalRepliesFlow = ai.defineFlow(
  {
    name: 'suggestLocalRepliesFlow',
    inputSchema: SuggestLocalRepliesInputSchema,
    outputSchema: SuggestLocalRepliesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
