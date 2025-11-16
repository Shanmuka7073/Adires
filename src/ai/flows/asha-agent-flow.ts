
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { ChatMessage } from '@/lib/types';
import { addUserContext } from '../genkit';
import { defineFlow, runFlow } from 'genkit';

const ADMIN_EMAIL = 'admin@gmail.com';

const ashaAgentFlow = defineFlow(
    {
        name: 'ashaAgentFlow',
        inputSchema: z.object({
            uid: z.string(), // UID from the client for context
            userMessage: z.string(),
            history: z.array(z.object({ role: z.enum(['user', 'model']), text: z.string() }))
        }),
        outputSchema: z.string(),
        middleware: [addUserContext], // Apply the auth middleware
    },
    async ({ uid, userMessage, history }, context) => {
        // Here, we can securely trust the context.auth object because the middleware verified it.
        if (context.auth?.email !== ADMIN_EMAIL) {
            console.warn(`Unauthorized access attempt to Asha Agent by user: ${context.auth?.email}`);
            throw new Error("You do not have permission to use this feature.");
        }
        
        // 1. Build the prompt including the conversational context and new message
        const conversationPrompt = history.map(m => `${m.role}: ${m.text}`).join('\n') + `\nuser: ${userMessage}`;
        
        // 2. Define the Agent's Persona
        const systemPrompt = `
            You are 'Asha,' a friendly, knowledgeable, and proactive personal shopping assistant for a grocery app in India.
            Your authenticated user's ID is ${context.auth.uid}.
            Your primary goal is to understand and respond naturally to multilingual users.
            CRITICAL MANDATES: Seamlessly understand and process input in English, Hindi, Telugu, Roman Telugu (e.g., 'ullipayalu'), mixed language (e.g., 'add milk and konni onions'), and misspellings. 
            Your tone is warm and conversational. Answer based on the context provided in the history. 
            If the user asks a simple action command (like 'add milk'), acknowledge the action conversationally and ask what's next. 
        `;

        try {
            const { text } = await ai.generate({
                model: 'googleai/gemini-2.5-flash-preview',
                prompt: `${systemPrompt}\n\n${conversationPrompt}`,
                config: {
                  temperature: 0.4
                }
            });

            // The flow's only job is to generate it.
            return text || "I'm not sure how to respond to that.";

        } catch (e) {
            console.error("Gemini API Call Error in Flow:", e);
            return "I apologize, but I couldn't connect to my language center right now.";
        }
    }
);

/**
 * The async function exported to the Server Action. It wraps and runs the Genkit flow.
 * @param input The data required by the ashaAgentFlow.
 * @returns The AI generated response.
 */
export async function runAshaFlow(input: z.infer<typeof ashaAgentFlow.inputSchema>): Promise<string> {
    return runFlow(ashaAgentFlow, input);
}
