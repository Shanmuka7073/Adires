
'use server';
/**
 * @fileOverview A conversational AI flow for the Asha Diagnostic Agent.
 *
 * - ashaChatFlow - A flow that takes a user's message and chat history and returns a response.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { format } from 'date-fns';

// Define the schema for a single chat message
const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string(),
});

// Define the input schema for the flow
const AshaChatInputSchema = z.object({
  history: z.array(MessageSchema).describe('The history of the conversation so far.'),
  message: z.string().describe('The latest message from the user.'),
});
export type AshaChatInput = z.infer<typeof AshaChatInputSchema>;

// Define the output schema for the flow
const AshaChatOutputSchema = z.string().describe('The AI model\'s response.');
export type AshaChatOutput = z.infer<typeof AshaChatOutputSchema>;


const ashaSystemPrompt = `You are Asha, a helpful and friendly AI diagnostic assistant for the LocalBasket grocery app. 
Your purpose is to help the admin user identify, understand, and resolve potential issues with the application.

Today's Date: ${format(new Date(), 'MMMM d, yyyy')}

- Be conversational and clear.
- When asked about errors, refer to the user's error logs and provide simple explanations.
- When asked about system health, you can mention checking component statuses.
- If you don't know the answer, say so. Do not make up information.
- You can provide code snippets if it helps explain a concept, but keep them short and relevant.
`;


export const ashaChatFlow = ai.defineFlow(
  {
    name: 'ashaChatFlow',
    inputSchema: AshaChatInputSchema,
    outputSchema: AshaChatOutputSchema,
  },
  async (input) => {
    // Construct the full prompt including history
    const fullPrompt = [
        ...input.history,
        { role: 'user' as const, text: input.message },
    ];
    
    // Generate a response from the model
    const { text } = await ai.generate({
        model: 'gemini-pro',
        prompt: fullPrompt,
        config: {
            // Optional: Adjust temperature for more creative/varied responses
            // temperature: 0.7, 
        },
        system: ashaSystemPrompt,
    });

    if (!text) {
        return "I'm sorry, I couldn't process that. Could you please rephrase?";
    }

    return text;
  }
);
