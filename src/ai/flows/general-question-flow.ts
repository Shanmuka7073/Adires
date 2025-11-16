
'use server';
/**
 * @fileOverview A flow to answer general knowledge questions.
 */

import { 
  GeneralQuestionInputSchema, 
  GeneralQuestionOutputSchema,
  type GeneralQuestionInput,
  type GeneralQuestionOutput,
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

    const generalQuestionFlow = ai.defineFlow(
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
    return generalQuestionFlow;
}


// This is the actual server action that will be called from the client
export async function answerGeneralQuestion(input: GeneralQuestionInput): Promise<GeneralQuestionOutput> {
  // We need to re-import the ai object here, but only inside the action.
  const { ai } = await import('@/ai/genkit');
  const flow = defineGeneralQuestionFlow(ai);
  return flow(input);
}
