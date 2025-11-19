'use server';
/**
 * @fileOverview A conversational AI diagnostic agent named Asha.
 *
 * - chatWithAsha - A function that handles a single turn in a conversation with Asha.
 * - AshaChatInput - The input type for the chatWithAsha function.
 * - AshaChatOutput - The return type for the chatWithAsha function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import type { ChatMessage } from '@/lib/types';

// Use the existing ChatMessage type for consistency
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string(),
});

const AshaChatInputSchema = z.object({
  history: z.array(ChatMessageSchema).describe('The conversation history so far.'),
  message: z.string().describe('The latest message from the user.'),
});
export type AshaChatInput = z.infer<typeof AshaChatInputSchema>;

// Output is just a string for the model's response
const AshaChatOutputSchema = z.string();
export type AshaChatOutput = z.infer<typeof AshaChatOutputSchema>;

export async function chatWithAsha(input: AshaChatInput): Promise<AshaChatOutput> {
  return ashaFlow(input);
}

const prompt = ai.definePrompt(
    {
      name: 'ashaPrompt',
      input: { schema: AshaChatInputSchema },
      output: { schema: AshaChatOutputSchema },
      model: googleAI.model('gemini-2.5-flash'),
      prompt: `You are Asha, a friendly and empathetic AI diagnostic assistant for the LocalBasket app.
Your primary role is to help users understand potential health issues based on the symptoms they describe.
You are not a doctor and you must always remind the user to consult a real medical professional.

Use the conversation history to maintain context.

Conversation History:
{{#each history}}
- {{role}}: {{text}}
{{/each}}

New User Message:
{{message}}

Your Response:
`,
    }
  );

const ashaFlow = ai.defineFlow(
  {
    name: 'ashaFlow',
    inputSchema: AshaChatInputSchema,
    outputSchema: AshaChatOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
