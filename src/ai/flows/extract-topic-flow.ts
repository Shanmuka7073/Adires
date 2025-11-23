'use server';
/**
 * @fileOverview An AI flow to extract the main topic from a user's question.
 *
 * - extractTopic - Extracts the main search topic from a natural language question.
 * - ExtractTopicInput - The input type for the flow.
 * - ExtractTopicOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const ExtractTopicInputSchema = z.object({
  question: z.string().describe('The natural language question from the user.'),
});
export type ExtractTopicInput = z.infer<typeof ExtractTopicInputSchema>;

const ExtractTopicOutputSchema = z.object({
  topic: z.string().describe("The core subject or topic of the question, suitable for a search query. For example, for 'tell me about the health benefits of turmeric', the topic would be 'turmeric'."),
});
export type ExtractTopicOutput = z.infer<typeof ExtractTopicOutputSchema>;

export async function extractTopic(input: ExtractTopicInput): Promise<ExtractTopicOutput> {
  return extractTopicFlow(input);
}

const prompt = ai.definePrompt({
    name: 'extractTopicPrompt',
    input: { schema: ExtractTopicInputSchema },
    output: { schema: ExtractTopicOutputSchema },
    model: googleAI.model('gemini-2.5-flash'),
    prompt: `Analyze the following user question and extract the main, searchable topic.
    
User Question: "{{question}}"

Focus on the primary noun or concept. For example:
- If the user asks "What are the spices used in biryani?", the topic is "biryani spices".
- If the user asks "Tell me about the history of the Mughal Empire", the topic is "Mughal Empire".
- If the user asks "how to make paneer butter masala", the topic is "paneer butter masala".

Extract the core topic from the user's question.
`,
});


const extractTopicFlow = ai.defineFlow(
  {
    name: 'extractTopicFlow',
    inputSchema: ExtractTopicInputSchema,
    outputSchema: ExtractTopicOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);

    if (!output) {
        // As a fallback, just use the original question if the AI fails
        return { topic: input.question };
    }
    
    return output;
  }
);
