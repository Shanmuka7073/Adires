
'use server';
/**
 * @fileOverview A flow to generate a grocery pack list using AI.
 */
import { ai } from '@/ai/genkit';
import { 
  GeneratePackInputSchema,
  GeneratePackOutputSchema,
  type GeneratePackInput,
  type GeneratePackOutput,
} from './schemas';

const generatePackPrompt = ai.definePrompt({
  name: 'generatePackPrompt',
  model: 'gemini-1.5-flash',
  input: { schema: GeneratePackInputSchema },
  output: { schema: GeneratePackOutputSchema },
  prompt: `You are an expert Indian home needs planner. Your task is to generate a realistic grocery list for an Indian family.

  Details:
  - Duration: {{{packType}}}
  - Family Size: {{{familySize}}} members
  {{#if cuisine}}
  - Cuisine Preference: {{{cuisine}}}
  {{/if}}

  Instructions:
  1. Generate a comprehensive list of essential Indian grocery items including vegetables, dals, spices, grains, dairy, and other staples.
  2. The quantities should be appropriate for the given family size and duration.
  3. Ensure the output is a valid JSON object matching the provided schema. Do not include any text or markdown before or after the JSON object.
  4. Item names should be common English names (e.g., "Onions", "Toor Dal", "Garam Masala").
  5. Quantities must be strings that include the unit (e.g., "2kg", "500g", "1 packet", "2 liters").
  `,
});

const generatePackFlow = ai.defineFlow(
  {
    name: 'generatePackFlow',
    inputSchema: GeneratePackInputSchema,
    outputSchema: GeneratePackOutputSchema,
  },
  async (input) => {
    const { output } = await generatePackPrompt(input);
    if (!output) {
      throw new Error("Failed to generate pack from AI.");
    }
    return output;
  }
);

export async function generatePack(input: GeneratePackInput): Promise<GeneratePackOutput> {
  return generatePackFlow(input);
}
