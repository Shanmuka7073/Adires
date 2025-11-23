'use server';
/**
 * @fileOverview An AI flow to get a list of ingredients for a recipe.
 *
 * - getIngredientsForDish - A function that gets ingredients for a given dish.
 * - GetIngredientsInput - The input type for the flow.
 * - GetIngredientsOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const GetIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish to get ingredients for.'),
  language: z.string().describe("The language for the output ingredients list (e.g., 'English', 'Telugu')."),
});
export type GetIngredientsInput = z.infer<typeof GetIngredientsInputSchema>;

const GetIngredientsOutputSchema = z.object({
    isSuccess: z.boolean().describe("Whether the ingredients were found successfully."),
    ingredients: z.array(z.string()).describe('The list of ingredients for the dish.'),
});
export type GetIngredientsOutput = z.infer<typeof GetIngredientsOutputSchema>;

export async function getIngredientsForDish(input: GetIngredientsInput): Promise<GetIngredientsOutput> {
  return getIngredientsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'getIngredientsPrompt',
    input: { schema: GetIngredientsInputSchema },
    output: { schema: GetIngredientsOutputSchema },
    model: googleAI.model('gemini-2.5-flash'),
    prompt: `You are a master chef. A user wants to know the main ingredients for a dish.
    
Dish: "{{dishName}}"

Provide a list of the 10-15 most important ingredients for this dish.
Return the list of ingredients in {{language}}.
If you do not know the recipe or it is not a food item, set isSuccess to false and return an empty ingredients list.`,
});


const getIngredientsFlow = ai.defineFlow(
  {
    name: 'getIngredientsFlow',
    inputSchema: GetIngredientsInputSchema,
    outputSchema: GetIngredientsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);

    if (!output) {
        return { isSuccess: false, ingredients: [] };
    }
    
    return output;
  }
);
