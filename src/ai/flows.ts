
'use server';
import { ai } from './genkit';
import { z } from 'zod';

export const sanityCheck = ai.defineFlow(
  {
    name: 'sanityCheck',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (subject) => {
    const { text } = await ai.generate({
      prompt: `Write a short, upbeat message about ${subject}`,
      model: 'gemini-pro',
    });

    if (!text) {
      throw new Error("The LLM did not generate a response.");
    }

    // Directly return the text response from the model
    return text;
  }
);
