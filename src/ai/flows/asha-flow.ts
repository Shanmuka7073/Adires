
'use server';
/**
 * @fileOverview A conversational AI diagnostic agent named Asha, enhanced for Admin Monitoring.
 *
 * - chatWithAsha - A function that handles a single turn in a conversation with Asha.
 * - AshaChatInput - The input type for the chatWithAsha function.
 * - AshaChatOutput - The return type for the chatWithAsha function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { ChatMessage } from '@/lib/types';
import { getAdminServices } from '@/firebase/admin-init';

// Use the existing ChatMessage type for consistency
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string(),
});

const AshaChatInputSchema = z.object({
  history: z.array(ChatMessageSchema).describe('The conversation history so far.'),
  message: z.string().describe('The latest message from the user.'),
  role: z.enum(['admin', 'owner', 'customer']).optional().default('customer').describe('The role of the user asking the question.'),
  storeId: z.string().optional().describe('The ID of the store if in owner mode.'),
});
export type AshaChatInput = z.infer<typeof AshaChatInputSchema>;

// Output is just a string for the model's response
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
      prompt: `You are Asha, a highly intelligent and friendly AI assistant for the LocalBasket platform.
Your behavior changes based on the user's role:

- **ADMIN**: You are a strategic monitor. Help them track platform health, revenue, and store counts. Use the 'getGlobalPlatformStats' tool if asked about totals.
- **OWNER**: You are a business manager. Help them with table tracking, daily totals, and prep status.
- **CUSTOMER**: You are an empathetic shopping assistant. Track their orders and suggest items.

Current User Role: {{role}}
{{#if storeId}}Target Store ID: {{storeId}}{{/if}}

Use the conversation history to maintain context.

Conversation History:
{{#each history}}
- {{role}}: {{text}}
{{/each}}

New Message:
{{message}}

Your Response:
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
