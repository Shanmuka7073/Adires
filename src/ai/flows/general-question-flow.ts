/**
 * @fileOverview A flow to answer general knowledge questions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getCachedAIResponse, cacheAIResponse } from '@/lib/ai-cache';


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
    model: 'googleai/gemini-1.5-pro',
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
    // NOTE: Caching logic has been temporarily removed from the flow
    // because it was incorrectly calling a client-side function from the server.
    // This will be reimplemented correctly in a separate step.
    console.log('Calling Gemini API for general question.');
    const { output } = await generalQuestionPrompt(input);
    const answer = output!.answer;
    
    return { answer };
  }
);
