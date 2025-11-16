'use server';
/**
 * @fileOverview A diagnostic flow to list all available Gemini models
 * supported by the currently configured GEMINI_API_KEY.
 */
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const ModelListOutputSchema = z.object({
  availableModels: z.array(z.string()).describe('A list of supported model names.'),
});

/**
 * Executes the listModels call to find supported model names.
 */
export const listSupportedModelsFlow = ai.defineFlow(
  {
    name: 'listSupportedModelsFlow',
    inputSchema: z.void(),
    outputSchema: ModelListOutputSchema,
  },
  async () => {
    try {
      // Direct call to the underlying Google Gen AI plugin to list models
      const models = await googleAI.listModels();
      
      const supportedModelNames = models
        .filter(model => model.name.includes('gemini') || model.name.includes('flash') || model.name.includes('pro'))
        .map(model => model.name)
        .sort();

      return { availableModels: supportedModelNames };

    } catch (e: any) {
      console.error("Error listing models:", e);
      return { availableModels: [`ERROR: Failed to list models. Check API key and network connection. Details: ${e.message}`] };
    }
  }
);

export async function listSupportedModels(): Promise<{ availableModels: string[] }> {
  // Execute the flow to get the list
  return listSupportedModelsFlow();
}
