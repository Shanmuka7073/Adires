
'use server';
/**
 * @fileOverview A conversational AI strategic agent named Asha.
 *
 * - chatWithAsha - A function that handles strategic product auditing and conversational Q&A.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAdminServices } from '@/firebase/admin-init';
import { getFileContent } from '@/app/actions';

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
    analysis: z.string().describe("The conversational response or strategic analysis text."),
    proposedCode: z.string().optional().describe("A full React/TypeScript code block if a UI change is suggested."),
    targetPath: z.string().optional().describe("The relative path of the file to be edited (e.g., 'src/app/page.tsx').")
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

/**
 * TOOL: Allows Asha to see the code of the page she is analyzing.
 */
const readSourceCode = ai.defineTool(
    {
        name: 'readSourceCode',
        description: 'Reads the content of a source file given its path.',
        inputSchema: z.object({ path: z.string() }),
        outputSchema: z.string(),
    },
    async (input) => {
        return await getFileContent(input.path);
    }
);

export async function chatWithAsha(input: AshaChatInput): Promise<z.infer<typeof AshaChatOutputSchema>> {
  return ashaFlow(input);
}

const prompt = ai.definePrompt(
    {
      name: 'ashaPrompt',
      input: { schema: AshaChatInputSchema },
      output: { schema: AshaChatOutputSchema },
      model: 'googleai/gemini-2.5-flash',
      tools: [getGlobalPlatformStats, readSourceCode],
      config: { temperature: 0 },
      prompt: `You are Asha, the Senior Strategic AI Architect for Adires (formerly LocalBasket).
Your goal is to perform deep-scans of the application state and assist with growth, performance, and AUTOMATED CODING.

TECHNICAL CONTEXT:
- Framework: Next.js 14 App Router.
- Styling: Tailwind CSS & ShadCN.
- Backend: Firebase Client SDK.
- Optimization: Operational Indexing & Persistent Cache.

DIRECTIVES:
1. **Analyze Code**: If the user asks to "edit" or "fix" something on the current page, use the 'readSourceCode' tool to inspect the file at the path related to {{context.pathname}}.
2. **Propose Changes**: If a UI adjustment is needed, provide the FULL, final refactored code in 'proposedCode' and the file path in 'targetPath'.
3. **Strategic Insight**: Always explain WHY you are making a change in 'analysis'.
4. **Format**: Return ONLY a JSON object matching the output schema.

CURRENT STATE:
- Page: {{context.pathname}}
- Role: {{role}}
- Vertical: {{businessType}}

History:
{{#each history}}
- {{role}}: {{text}}
{{/each}}

User Request:
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
    try {
        const { output } = await prompt(input);
        if (!output || !output.analysis) {
            throw new Error("Asha is currently calibrating. Please try re-sending your question.");
        }
        return output;
    } catch (error: any) {
        console.error("Asha Flow Error:", error);
        return {
            analysis: `Asha Error: ${error.message || String(error)}. Action: Please try again.`,
        };
    }
  }
);
