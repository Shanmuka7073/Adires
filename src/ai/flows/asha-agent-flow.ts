
'use server';
/**
 * @fileOverview The Genkit flow for the Asha conversational agent.
 */
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


const ai = genkit({
    plugins: [
        googleAI({
            // You must also set the GEMINI_API_KEY environment variable.
            // You can get a key from Google AI Studio.
            // https://aistudio.google.com/app/apikey
        }),
    ],
    policy: {
        run: {
            action: 'allow',
            subjects: 'all',
            conditions: [],
        },
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
  async ({ userMessage, chatHistory }) => {
    
    // Map the input chat history to the format expected by the Gemini model.
    const history = chatHistory.map(msg => ({
      role: msg.role as 'user' | 'model', // Cast role to the expected type
      parts: [{ text: msg.text }],
    }));

    // The Genkit flow runner automatically combines the system prompt, history, and the new user message.
    // We just need to pass the new user message in the 'prompt' field and the context in 'history'.
    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: userMessage,
      history,
    });
    
    // Return the generated text directly.
    return result.text;
  }
);


/**
 * The server action called by the client.
 * It runs the Genkit flow and saves the AI's response to Firestore.
 */
export async function askAsha(input: AskAshaInput): Promise<void> {
    const { db } = await getAdminServices();

    // The middleware automatically adds the user's UID to the flow's metadata.
    // We can retrieve it from the flow's state after it runs.
    const flowResult = await askAshaFlow(input);
    
    // The `getFlowState` is an internal Genkit mechanism to access metadata.
    const state = (ai as any).getFlowState();
    const uid = state?.metadata?.uid;
    
    if (!uid) {
        throw new Error("User is not authenticated. Cannot save AI response.");
    }
    
    // Save the AI's response to the correct user's conversation subcollection.
    const conversationRef = collection(db, `/users/${uid}/ashaConversation`);
    await addDoc(conversationRef, {
        text: flowResult,
        role: 'model',
        timestamp: serverTimestamp()
    });
}
