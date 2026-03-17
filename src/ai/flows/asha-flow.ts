'use server';
/**
 * @fileOverview A conversational AI strategic agent named Asha.
 *
 * - chatWithAsha - A function that handles strategic product auditing and conversational Q&A.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAdminServices } from '@/firebase/admin-init';

const AshaChatInputSchema = z.object({
  history: z.array(z.object({
    role: z.string(),
    text: z.string()
  })).optional().default([]),
  message: z.string(),
  role: z.string().optional().default('customer'),
  storeId: z.string().optional(),
  businessType: z.string().optional(),
  context: z.object({
      pathname: z.string().optional(),
  }).optional().default({ pathname: 'unknown' }),
}).passthrough();
export type AshaChatInput = z.infer<typeof AshaChatInputSchema>;

const AshaChatOutputSchema = z.object({
    analysis: z.string().describe("The conversational response or strategic analysis text.")
});

/**
 * TOOL: Fetches global platform statistics for Admin monitoring.
 */
const getGlobalPlatformStats = ai.defineTool(
  {
    name: 'getGlobalPlatformStats',
    description: 'Retrieves platform-wide counts for users, stores, and orders.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      totalUsers: z.number(),
      totalStores: z.number(),
      totalOrders: z.number(),
    }),
  },
  async () => {
    try {
        const { db } = await getAdminServices();
        if (!db) throw new Error("Database not initialized");

        const [users, stores, orders] = await Promise.all([
          db.collection('users').count().get(),
          db.collection('stores').count().get(),
          db.collection('orders').count().get(),
        ]);
        return {
          totalUsers: users.data().count || 0,
          totalStores: stores.data().count || 0,
          totalOrders: orders.data().count || 0,
        };
    } catch (e: any) {
        console.error("Tool getGlobalPlatformStats failed:", e);
        return { totalUsers: 0, totalStores: 0, totalOrders: 0 };
    }
  }
);

export async function chatWithAsha(input: AshaChatInput): Promise<string> {
  return ashaFlow(input);
}

const prompt = ai.definePrompt(
    {
      name: 'ashaPrompt',
      input: { schema: AshaChatInputSchema },
      output: { schema: AshaChatOutputSchema },
      model: 'googleai/gemini-2.5-flash',
      tools: [getGlobalPlatformStats],
      prompt: `You are Asha, the Senior Strategic AI Architect for LocalBasket. 
Your goal is to perform deep-scans of the application state and answer user questions about development, growth, and technical behavior.

TECHNICAL CONTEXT (Internal Knowledge):
- Framework: Next.js 14 App Router.
- Backend: Firebase Client SDK exclusively.
- State Management: Zustand with localStorage persistence.
- Page Load Behavior: The 'ClientRoot' uses a 'useInitializeApp' hook that fetches core data (Stores, Products, Voice Aliases) before unlocking the UI.
- Performance: "Operational Indexing" is used to keep Firestore reads low.
- Navigation: Moving between pages might show a Global Loader if the Firebase Auth state or data store is re-validating.

CURRENT STATE:
- User is on page: {{context.pathname}}
- User Role: {{role}}
{{#if businessType}}- Business Vertical: {{businessType}}{{/if}}

STRATEGIC DIRECTIVES:
1. **Identify the Gap**: If the user asks for a prediction, look at what is likely missing on {{context.pathname}} given the role of {{role}}.
2. **Technical Clarity**: If the user asks about performance or "why something is happening", explain it using the internal knowledge provided above (e.g., explaining that page load delays are often due to Firebase initialization or parallel data fetching in the Zustand store).
3. **Economic Impact**: Link technical choices to business KPIs (e.g., "Implementing X reduces read costs by 40%").

Format your response in 'analysis'. If it's a strategic prediction, use the 🚀 and 💡 icons. If it's a direct answer to a question, be professional, helpful, and concise.

History:
{{#each history}}
- {{role}}: {{text}}
{{/each}}

User Question:
{{message}}
`,
    }
  );

const ashaFlow = ai.defineFlow(
  {
    name: 'ashaFlow',
    inputSchema: AshaChatInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    try {
        const { output } = await prompt(input);
        if (!output || !output.analysis) {
            throw new Error("Asha is currently calibrating. Please try re-sending your question.");
        }
        return output.analysis;
    } catch (error: any) {
        console.error("Asha Flow Error:", error);
        return `Asha Error: ${error.message || String(error)}. Path: ${input.context?.pathname}. Action: Please check your internet and try again.`;
    }
  }
);
