
'use server';
/**
 * @fileOverview An AI flow to translate a grocery item into multiple languages.
 *
 * - disambiguateItem - A function that takes a single term and returns its translation in English, Telugu, and Hindi.
 * - ItemDisambiguation - The return type for the disambiguation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ItemDisambiguationSchema = z.object({
  english: z.string().describe('The English name for the item.'),
  telugu: z.string().describe('The Telugu name for the item.'),
  hindi: z.string().describe('The Hindi name for the item.'),
});
export type ItemDisambiguation = z.infer<typeof ItemDisambiguationSchema>;

export async function disambiguateItem(
  term: string
): Promise<ItemDisambiguation | null> {
  return disambiguateItemFlow(term);
}

const disambiguateItemFlow = ai.defineFlow(
  {
    name: 'disambiguateItemFlow',
    inputSchema: z.string(),
    outputSchema: ItemDisambiguationSchema,
  },
  async (term) => {
    const prompt = `You are a linguistic expert specializing in Indian grocery items.
      A user has provided a term: "${term}".
      
      Your task is to identify this grocery item and provide its name in the following three languages:
      1. English
      2. Telugu
      3. Hindi
      
      If the term is ambiguous or not a grocery item, make your best guess.
      Return the result in the specified JSON format.`;

    const { output } = await ai.generate({
      prompt: prompt,
      model: 'googleai/gemini-1.5-flash-latest',
      output: {
        schema: ItemDisambiguationSchema,
      },
    });

    return output;
  }
);
