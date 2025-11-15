
/**
 * @fileOverview A flow to answer general knowledge questions.
 */

'use server';

import { getAiInstance } from '@/ai/genkit';
import { 
  GeneralQuestionInputSchema, 
  GeneralQuestionOutputSchema,
  type GeneralQuestionInput,
  type GeneralQuestionOutput,
} from './schemas';

// The function exported to the client side.
export async function answerGeneralQuestion(input: GeneralQuestionInput): Promise<GeneralQuestionOutput> {
  // Caching is now handled on the client-side before this action is called.
  const generalQuestionFlow = await createGeneralQuestionFlow();
  return generalQuestionFlow(input);
}

// Internal function to create the flow on demand.
async function createGeneralQuestionFlow() {
    const ai = await getAiInstance();
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

    return ai.defineFlow(
      {
        name: 'generalQuestionFlow',
        inputSchema: GeneralQuestionInputSchema,
        outputSchema: GeneralQuestionOutputSchema,
      },
      async (input) => {
        // The client-side logic in VoiceCommander now handles caching.
        // This flow simply gets the answer from the AI.
        console.log('Calling Gemini API for general question.');
        const { output } = await generalQuestionPrompt(input);
        const answer = output!.answer;
        
        return { answer };
      }
    );
}
