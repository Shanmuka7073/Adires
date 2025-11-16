
'use server';

import { genkit, AIMiddleware, type Candidate, type Part } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { z } from 'zod';
import { getAdminServices } from '@/firebase/admin-init';
import { addUserContext } from '@/ai/genkit';

const CONVERSATION_PATH_PREFIX = 'asha-conversations';

// Define the shape of a chat message for context history
export type ChatMessage = {
    role: 'user' | 'model';
    text: string;
};

// This AI instance is configured to use the user context middleware
const ai = genkit({
    plugins: [googleAI()],
    logLevel: 'debug',
    enableTracingAndMetrics: true,
});

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
    const userConversationPath = `${CONVERSATION_PATH_PREFIX}/${uid}/conversation`;
    const { db } = getAdminServices();

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
            model: 'googleai/gemini-2.5-flash',
            prompt: conversationPrompt,
            config: {
                // System prompt is now passed in the config
                systemInstruction: systemPrompt,
            },
        });

        // 3. Save model's response to Firestore history
        await addDoc(collection(db, userConversationPath), {
            text: text,
            role: 'model',
            timestamp: Date.now()
        });

        return text;
    } catch (e) {
        console.error("Gemini API Call Error in Flow:", e);
        // Save an error message to the chat history as well
        const errorMessage = "I apologize, but I couldn't connect to my language center right now.";
         await addDoc(collection(db, userConversationPath), {
            text: errorMessage,
            role: 'model',
            timestamp: Date.now()
        });
        return errorMessage;
    }
}
