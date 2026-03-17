
'use server';
/**
 * @fileOverview A conversational AI diagnostic agent named Asha, enhanced for Strategic Development Prediction.
 *
 * - chatWithAsha - A function that handles a single turn in a conversation with Asha.
 * - AshaChatInput - The input type for the chatWithAsha function.
 * - AshaChatOutput - The return type for the chatWithAsha function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAdminServices } from '@/firebase/admin-init';

// Use simple schemas for the chat turn
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string(),
});

const AshaChatInputSchema = z.object({
  history: z.array(ChatMessageSchema).describe('The conversation history so far.'),
  message: z.string().describe('The latest message from the user.'),
  role: z.enum(['admin', 'owner', 'customer']).optional().default('customer').describe('The role of the user asking the question.'),
  storeId: z.string().optional().describe('The ID of the store if in owner mode.'),
  context: z.object({
      pathname: z.string().describe('The current page path the user is viewing.'),
      platformStatus: z.string().optional().describe('Current status of the system.'),
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
    description: 'Retrieves total user count, store count, and order summary for the entire platform.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      totalUsers: z.number(),
      totalStores: z.number(),
      totalOrders: z.number(),
    }),
  },
  async () => {
    const { db } = await getAdminServices();
    const [users, stores, orders] = await Promise.all([
      db.collection('users').get(),
      db.collection('stores').get(),
      db.collection('orders').where('status', 'in', ['Delivered', 'Completed']).get(),
    ]);
    return {
      totalUsers: users.size,
      totalStores: stores.size,
      totalOrders: orders.size,
    };
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
      model: 'googleai/gemini-2.0-flash-lite-preview-02-05',
      tools: [getGlobalPlatformStats],
      prompt: `You are Asha, a highly intelligent Strategic AI Consultant and Product Architect for the LocalBasket platform.
Your mission is to help the user grow the platform by predicting required developments and explaining the "Why" behind them.

CURRENT CONTEXT:
- Page Path: {{context.pathname}}
- User Role: {{role}}
{{#if storeId}}- Target Store ID: {{storeId}}{{/if}}

STRATEGIC GUIDELINES:
1. **Predict Development**: Based on the page the user is currently viewing ({{context.pathname}}), identify 1-2 critical features or technical improvements that should be built next.
2. **Explain the "Why"**: Don't just list features. Explain the economic or operational impact (e.g., "Building a real-time table map will reduce order wait time by 15% and increase table turnover").
3. **Role-Awareness**:
   - If user is ADMIN: Focus on scalability, security, and platform-wide revenue analytics.
   - If user is OWNER: Focus on operational efficiency, customer retention, and upsell opportunities.
   - If user is CUSTOMER: Focus on frictionless ordering, personalization, and discovery.

Keep your responses conversational but highly professional and data-driven.

Conversation History:
{{#each history}}
- {{role}}: {{text}}
{{/each}}

New Message:
{{message}}

Your Strategic Response:
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
