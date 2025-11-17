
'use server';
/**
 * @fileOverview A simple Genkit flow to verify AI connectivity.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SanityCheckInputSchema = z.string();
const SanityCheckOutputSchema = z.string();

export async function sanityCheck(input: string): Promise<string> {
    return sanityCheckFlow(input);
}

const prompt = ai.definePrompt({
    name: 'sanityCheckPrompt',
    input: {schema: SanityCheckInputSchema},
    output: {schema: SanityCheckOutputSchema},
    prompt: `The user is asking: "{{prompt}}". Respond by confirming that the AI system is operational and ready.`,
});

const sanityCheckFlow = ai.defineFlow(
  {
    name: 'sanityCheckFlow',
    inputSchema: SanityCheckInputSchema,
    outputSchema: SanityCheckOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
