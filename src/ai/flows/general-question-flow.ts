/**
 * @fileOverview A flow to answer general knowledge questions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const GeneralQuestionInputSchema = z.object({
  question: z.string().describe('The user\'s question.'),
});

export const GeneralQuestionOutputSchema = z.object({
  answer: z.string().describe('The AI\'s answer to the question.'),
});

export type GeneralQuestionInput = z.infer<typeof GeneralQuestionInputSchema>;
export type GeneralQuestionOutput = z.infer<typeof GeneralQuestionOutputSchema>;

const generalQuestionPrompt = ai.definePrompt(
  {
    name: 'generalQuestionPrompt',
    model: 'googleai/gemini-2.5-flash',
    input: { schema: GeneralQuestionInputSchema },
    output: { schema: GeneralQuestionOutputSchema },
    prompt: `You are a helpful voice assistant. Answer the following question concisely.

    Question: {{{question}}}
    `,
  }
);

export const generalQuestionFlow = ai.defineFlow(
  {
    name: 'generalQuestionFlow',
    inputSchema: GeneralQuestionInputSchema,
    outputSchema: GeneralQuestionOutputSchema,
  },
  async (input) => {
    const { output } = await generalQuestionPrompt(input);
    return output!;
  }
);
