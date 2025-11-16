
/**
 * @fileOverview A flow to answer general knowledge questions.
 */

'use server';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { 
  GeneralQuestionInputSchema, 
  GeneralQuestionOutputSchema,
  type GeneralQuestionInput,
  type GeneralQuestionOutput,
} from './schemas';

// Configure the AI instance for this specific flow
const ai = genkit({
  plugins: [googleAI()],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});


const generalQuestionPrompt = ai.definePrompt(
  {
    name: 'generalQuestionPrompt',
    model: 'googleai/gemini-pro',
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
    // The client-side logic in VoiceCommander now handles caching.
    // This flow simply gets the answer from the AI.
    console.log('Calling Gemini API for general question.');
    const { output } = await generalQuestionPrompt(input);
    const answer = output!.answer;
    
    return { answer };
  }
);

// The function exported to the client side.
export async function answerGeneralQuestion(input: GeneralQuestionInput): Promise<GeneralQuestionOutput> {
  return generalQuestionFlow(input);
}
