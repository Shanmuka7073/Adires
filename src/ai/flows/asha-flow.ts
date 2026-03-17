
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

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string(),
});

const AshaChatInputSchema = z.object({
  history: z.array(ChatMessageSchema).describe('The conversation history.'),
  message: z.string().describe('The latest message from the user.'),
  role: z.enum(['admin', 'owner', 'customer']).optional().default('customer'),
  storeId: z.string().optional(),
  businessType: z.enum(['restaurant', 'salon', 'grocery']).optional().describe('The type of business currently being viewed.'),
  context: z.object({
      pathname: z.string().describe('The current page path.'),
      platformStatus: z.string().optional(),
  }).optional(),
});
export type AshaChatInput = z.infer<typeof AshaChatInputSchema>;

const AshaChatOutputSchema = z.string();
export type AshaChatOutput = z.infer<typeof AshaChatOutputSchema>;

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
        const [users, stores, orders] = await Promise.all([
          db.collection('users').count().get(),
          db.collection('stores').count().get(),
          db.collection('orders').count().get(),
        ]);
        return {
          totalUsers: users.data().count,
          totalStores: stores.data().count,
          totalOrders: orders.data().count,
        };
    } catch (e) {
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
      model: 'googleai/gemini-1.5-flash',
      tools: [getGlobalPlatformStats],
      prompt: `You are Asha, the Senior Strategic AI Architect for LocalBasket. 
Your goal is to audit the current page and predict the next logical development step to grow the business.

CURRENT STATE:
- User is on page: {{context.pathname}}
- User Role: {{role}}
{{#if businessType}}- Business Vertical: {{businessType}}{{/if}}

STRATEGIC DIRECTIVES:
1. **Identify the Gap**: Look at what is likely missing on the page {{context.pathname}} given the role of {{role}}.
2. **Predict Development**: Propose one specific feature or technical optimization.
3. **Explain the "Why"**: Link the proposal to economic impact (e.g., "Implementing X will reduce churn by Y%").
4. **Be Vertical-Specific**: If {{businessType}} is 'salon', suggest beauty-specific tech (e.g., 'Stylist Slot Optimization'). If 'restaurant', suggest kitchen tech (e.g., 'Ticket Wait-Time Forecasting').

Format your response with:
🚀 **Prediction**: [The feature name]
💡 **Strategic "Why"**: [The business/technical reasoning]

Keep it concise, professional, and visionary.

History:
{{#each history}}
- {{role}}: {{text}}
{{/each}}

Message:
{{message}}
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
    return output || "I've analyzed the platform state but am currently calibrating my strategic engines. Please try again in a moment.";
  }
);
