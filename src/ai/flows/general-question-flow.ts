
'use server';
/**
 * @fileOverview A flow to answer general knowledge questions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getCachedAIResponse, cacheAIResponse } from '@/lib/ai-cache';
import { initializeFirebase } from '@/firebase';

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
    // Initialize Firebase services to interact with Firestore.
    // This is safe to call multiple times.
    const { firestore } = initializeFirebase();

    // 1. Check cache first
    const cachedAnswer = await getCachedAIResponse(firestore, input.question);
    if (cachedAnswer) {
      console.log('Returning cached AI response.');
      return { answer: cachedAnswer };
    }

    // 2. If not in cache, call the AI model
    console.log('No cache hit. Calling Gemini API.');
    const { output } = await generalQuestionPrompt(input);
    const answer = output!.answer;

    // 3. Cache the new response for future use
    if (answer) {
      await cacheAIResponse(firestore, input.question, answer);
    }
    
    return { answer };
  }
);
