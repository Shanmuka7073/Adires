
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { ChatMessage } from '@/lib/types';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * The core AI flow that processes the user's message.
 * This function now receives the verified UID directly.
 * @param uid The verified Firebase User ID.
 * @param userMessage The latest message from the user.
 * @param history The contextual chat history.
 * @returns The AI generated response.
 */
export async function runAshaFlow(uid: string, userMessage: string, history: ChatMessage[]): Promise<string> {
    // The UID is guaranteed to be valid because it was verified in the Server Action
    
    // 1. Build the prompt including the conversational context and new message
    const conversationPrompt = history.map(m => `${m.role}: ${m.text}`).join('\n') + `\nuser: ${userMessage}`;
    
    // 2. Define the Agent's Persona
    const systemPrompt = `
        You are 'Asha,' a friendly, knowledgeable, and proactive personal shopping assistant for a grocery app in India. 
        Your primary goal is to understand and respond naturally to multilingual users.
        CRITICAL MANDATES: Seamlessly understand and process input in English, Hindi, Telugu, Roman Telugu (e.g., 'ullipayalu'), mixed language (e.g., 'add milk and konni onions'), and misspellings. 
        Your tone is warm and conversational. Answer based on the context provided in the history. 
        If the user asks a simple action command (like 'add milk'), acknowledge the action conversationally and ask what's next. 
    `;

    try {
        const { text } = await ai.generate({
            model: googleAI.model('gemini-pro'),
            prompt: conversationPrompt,
            config: {
                // In Genkit 1.x, system instructions are passed within the config
                // This property name might vary based on the exact plugin version; 'systemInstruction' is a common pattern.
            },
            // For some models, the system prompt is part of the main prompt.
            // Let's ensure compatibility by combining it.
            // A more modern approach might use a dedicated 'system' property if the model supports it.
            // For this fix, we will prepend it to the main prompt.
            prompt: `${systemPrompt}\n\n${conversationPrompt}`,
        });

        // The Server Action will save the response. The flow's only job is to generate it.
        return text || "I'm not sure how to respond to that.";

    } catch (e) {
        console.error("Gemini API Call Error in Flow:", e);
        return "I apologize, but I couldn't connect to my language center right now.";
    }
}
