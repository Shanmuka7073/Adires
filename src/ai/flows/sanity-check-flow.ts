'use server';
import { ai } from '@/ai/genkit';
import * as genkit from 'genkit';
import { z } from 'zod';

/**
 * A simple flow to verify that the core AI model generation is working.
 */
export const sanityCheckFlow = genkit.defineFlow(
  {
    name: 'sanityCheckFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (prompt) => {
    try {
      const llmResponse = await genkit.generate({
        prompt: `This is a sanity check. The user entered: \"${prompt}\". Please respond with a simple confirmation, like \"Message received\".`,
        model: ai.getGenerator('google-genai/gemini-pro')
      });

      const textResponse = llmResponse.text();
      if (!textResponse) {
        return "Error: The AI model returned an empty response.";
      }
      return textResponse;
    } catch (e: any) {
      console.error("AI sanity check failed:", e);
      // Return a more descriptive error to the client.
      return `Error in AI flow: ${e.message}`;
    }
  }
);
