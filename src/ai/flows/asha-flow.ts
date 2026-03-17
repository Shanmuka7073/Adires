'use server';
/**
 * @fileOverview A conversational AI strategic agent named Asha.
 *
 * - chatWithAsha - A function that handles strategic product auditing.
 * - AshaChatInput - The input type including page context and business vertical.
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

// Changed to an object for more reliable JSON generation
const AshaChatOutputSchema = z.object({
    analysis: z.string().describe("The strategic analysis and prediction text.")
});
export type AshaChatOutput = string;

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

export async function chatWithAsha(input: AshaChatInput): Promise<AshaChatOutput> {
  return ashaFlow(input);
}

const prompt = ai.definePrompt(
    {
      name: 'ashaPrompt',
      input: { schema: AshaChatInputSchema },
      output: { schema: AshaChatOutputSchema },
      // Switched to stable 1.5-flash for more reliable structured output
      model: 'googleai/gemini-1.5-flash',
      tools: [getGlobalPlatformStats],
      prompt: `You are Asha, the Senior Strategic AI Architect for LocalBasket. 
Your goal is to perform a deep-scan of the current application state and predict the next logical development step to maximize business growth and user engagement.

CURRENT STATE:
- User is on page: {{context.pathname}}
- User Role: {{role}}
{{#if businessType}}- Business Vertical: {{businessType}}{{/if}}

STRATEGIC DIRECTIVES:
1. **Identify the Gap**: Look at what is likely missing on the page {{context.pathname}} given the role of {{role}}. Think about high-conversion features (e.g., personalized bundles, loyalty rewards, or automated inventory syncing).
2. **Predict Technical Debt**: Propose a specific optimization (e.g., "Implement Firestore Query Caching for this list" or "Move to subcollections for order items to reduce document size").
3. **Explain the Economic Impact**: Link every proposal to a specific KPI (e.g., "Implementing X will increase Table Turnover by 12%" or "This fix will reduce Firestore Read costs by 40%").
4. **Be Industry-Specific**: 
   - If {{businessType}} is 'salon', suggest time-slot optimization or stylist performance tracking.
   - If 'restaurant', suggest kitchen ticket forecasting or digital waste management.
   - If 'grocery', suggest expiration date tracking or bulk-buy incentives.

Format the 'analysis' field exactly as:
🚀 **Prediction**: [The name of the feature or fix]
💡 **Strategic "Why"**: [The technical and business justification]

Keep your tone professional, visionary, and concise.

History:
{{#each history}}
- {{role}}: {{text}}
{{/each}}

Latest Message:
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
        return output?.analysis || "I've analyzed the platform state but am currently re-calibrating. Please try the scan again.";
    } catch (error: any) {
        console.error("Asha Flow Error:", error);
        // Providing specific technical feedback for debugging if it happens again
        return `Asha Audit Error: ${error.message || String(error)}. Context: ${input.context?.pathname}. Please retry.`;
    }
  }
);
