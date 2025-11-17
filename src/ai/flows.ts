'use server';
/**
 * @fileOverview This file contains Genkit flows for the application.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const sanityCheck = ai.defineFlow(
  {
    name: 'sanityCheck',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (subject) => {
    try {
      const { text } = await ai.generate({
        prompt: `Write a short, upbeat message about ${subject}`,
        model: 'gemini-pro',
      });
      return text || "AI model did not return a response.";
    } catch (e: any) {
        console.error("Sanity check flow failed:", e);
        // Return a structured error message that the client can display.
        return `Error: ${e.message || 'An unknown error occurred during AI generation.'}`;
    }
  }
);
