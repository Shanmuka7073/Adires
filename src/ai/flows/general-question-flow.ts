
'use server';
/**
 * @fileOverview A flow to answer general knowledge questions.
 */

import { 
  GeneralQuestionInputSchema, 
  GeneralQuestionOutputSchema,
} from './schemas';
import { Genkit } from 'genkit';


export const defineGeneralQuestionFlow = (ai: Genkit) => {
    const generalQuestionPrompt = ai.definePrompt(
        {
            name: 'generalQuestionPrompt',
            model: 'gemini-2.5-flash',
            input: { schema: GeneralQuestionInputSchema },
            output: { schema: GeneralQuestionOutputSchema },
            prompt: `You are a helpful voice assistant. Answer the following question concisely.

    Question: {{{question}}}
    `,
        }
    );

    ai.defineFlow(
        {
            name: 'generalQuestionFlow',
            inputSchema: GeneralQuestionInputSchema,
            outputSchema: GeneralQuestionOutputSchema,
        },
        async (input) => {
            console.log('Calling Gemini API for general question.');
            const { output } = await generalQuestionPrompt(input);
            const answer = output!.answer;
            
            return { answer };
        }
    );
}
