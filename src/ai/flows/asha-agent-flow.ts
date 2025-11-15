
'use server';
/**
 * @fileOverview The Genkit flow for the Asha conversational agent.
 */
import { type FlowContext } from 'genkit';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { addUserContext } from '@/ai/genkit';
import { getAdminServices } from '@/firebase/admin-init';
import { addDoc, collection, serverTimestamp } from 'firebase-admin/firestore';
import { 
  AskAshaInputSchema, 
  AskAshaOutputSchema,
  type AskAshaInput,
} from './schemas';

// Configure the AI instance for this specific flow
const ai = genkit({
    plugins: [googleAI()],
    policy: {
        run: { action: 'allow', subjects: 'all' },
        use: [addUserContext],
    },
    logLevel: 'debug',
    enableTracingAndMetrics: true,
});

const askAshaFlow = ai.defineFlow(
  {
    name: 'askAshaFlow',
    inputSchema: AskAshaInputSchema,
    outputSchema: AskAshaOutputSchema,
    system: `
        You are 'Asha,' a friendly, knowledgeable, and proactive personal shopping assistant for a grocery app in India. 
        Your primary goal is to understand and respond naturally to multilingual Indian users.
        
        CRITICAL MANDATES:
        1. Multilingual & Slang: Seamlessly understand and process input in English, Hindi, Telugu, Roman Telugu (e.g., 'ullipayalu'), mixed language (e.g., 'add milk and konni onions'), and misspellings.
        2. Persona: Your tone is warm, conversational, and culturally appropriate for Kurnool, Andhra Pradesh.
        3. Context: You remember the last 5 messages.
        4. Action Handling: When the user issues a clear action (like 'add'), confirm the action conversationally (e.g., 'Done! Adding that right away.') and maintain the dialogue. Your focus is dialogue and context management, not just list management.
        
        Keep your responses concise, helpful, and focused on assisting with their shopping needs.
    `,
  },
  async ({ userMessage, chatHistory }, context: FlowContext) => {
    
    // The user's UID is now available on the context object, thanks to the middleware.
    const uid = context.auth?.uid;
    if (!uid) {
        throw new Error("Flow Error: User is not authenticated.");
    }
    
    // The Genkit flow runner automatically combines the system prompt, history, and the new user message.
    // We just need to pass the new user message in the 'prompt' field and the context in 'history'.
    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: userMessage,
      history: chatHistory,
    });
    
    const aiResponseText = result.text;
    
    // The flow now handles saving the conversation history.
    const { db } = await getAdminServices();
    const conversationRef = collection(db, `/users/${uid}/ashaConversation`);

    // Save both user and model message in one go after getting the response.
    await Promise.all([
        addDoc(conversationRef, {
            text: userMessage,
            role: 'user',
            timestamp: serverTimestamp()
        }),
        addDoc(conversationRef, {
            text: aiResponseText,
            role: 'model',
            timestamp: serverTimestamp()
        })
    ]);

    // The output schema is just a string, so we return the AI's text response.
    return aiResponseText;
  }
);


/**
 * The server action called by the client.
 * It prepares the input and runs the Genkit flow.
 */
export async function askAsha(input: AskAshaInput) {
    // The middleware attached to the flow will handle adding the user's UID.
    // We just need to call the flow. The flow itself now handles all database writes.
    return await askAshaFlow(input);
}
