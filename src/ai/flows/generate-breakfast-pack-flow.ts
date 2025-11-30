'use server';
/**
 * @fileOverview An AI flow to generate customized breakfast packs.
 *
 * - generateBreakfastPack - A function that creates a breakfast plan for a specified duration.
 * - GenerateBreakfastPackInput - The input type for the flow.
 * - GenerateBreakfastPackOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const mainBreakfastItems = ['Idli', 'Dosa', 'Poori', 'Chapati', 'Upma', 'Uggani'];

const GenerateBreakfastPackInputSchema = z.object({
  duration: z.enum(['7days', '15days', 'monthly']).describe('The duration of the breakfast plan.'),
  familySize: z.number().min(1).describe('The number of people in the family.'),
  sideItemPreference: z.string().optional().describe('User preference for side dishes, like "peanut chutney" or "sambar".'),
  productPrices: z.record(z.string(), z.number()).describe('A map of product names to their price per base unit (e.g., kg or litre).'),
});
export type GenerateBreakfastPackInput = z.infer<typeof GenerateBreakfastPackInputSchema>;

const DayPlanSchema = z.object({
  day: z.number(),
  mainItem: z.string(),
  sideItem: z.string(),
});

const ShoppingListItemSchema = z.object({
  itemName: z.string(),
  quantity: z.string(),
});

const GenerateBreakfastPackOutputSchema = z.object({
  packName: z.string().describe("The name of the generated pack (e.g., '7-Day Family Breakfast Plan')."),
  schedule: z.array(DayPlanSchema).describe("The day-by-day breakfast schedule."),
  shoppingList: z.array(ShoppingListItemSchema).describe("A consolidated shopping list of all ingredients required for the plan."),
  estimatedCost: z.number().describe("The estimated total cost of all ingredients."),
});
export type GenerateBreakfastPackOutput = z.infer<typeof GenerateBreakfastPackOutputSchema>;


export async function generateBreakfastPack(input: GenerateBreakfastPackInput): Promise<GenerateBreakfastPackOutput> {
  return generateBreakfastPackFlow(input);
}


const prompt = ai.definePrompt({
  name: 'generateBreakfastPackPrompt',
  input: { schema: GenerateBreakfastPackInputSchema },
  output: { schema: GenerateBreakfastPackOutputSchema },
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are an expert Indian chef and meal planner. Your task is to create a breakfast pack for a family of {{familySize}} for a duration of {{duration}}.

Base Main Items:
- Idli
- Dosa
- Poori
- Chapati
- Upma
- Uggani

User's side item preference: {{sideItemPreference}}

Available item prices (per kg or litre):
{{#each productPrices}}
- {{@key}}: ₹{{this}}
{{/each}}

Instructions:
1.  **Create a Schedule**: Generate a day-by-day schedule. For a 7-day plan, use each main item once, with one repeat. For 15-day and monthly plans, create a sensible rotation.
2.  **Suggest Side Items**: For each day, suggest a suitable side item (like chutney, sambar, or curry). Consider the user's preference: "{{sideItemPreference}}". If no preference is given, choose a classic pairing.
3.  **Create Shopping List**: Calculate the total quantity of each ingredient needed for the entire plan for {{familySize}} people. Be realistic (e.g., a family of 4 needs more batter than a family of 1). Output quantities with units (e.g., "1.5kg", "500ml").
4.  **Estimate Cost**: Using the provided prices, calculate the total estimated cost for all items on the shopping list.
5.  **Generate Output**: Structure your entire response according to the output schema.
`,
});

const generateBreakfastPackFlow = ai.defineFlow(
  {
    name: 'generateBreakfastPackFlow',
    inputSchema: GenerateBreakfastPackInputSchema,
    outputSchema: GenerateBreakfastPackOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("AI failed to generate a breakfast pack.");
    }
    return output;
  }
);
