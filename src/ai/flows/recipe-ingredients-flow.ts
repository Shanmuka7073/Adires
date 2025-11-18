'use server';
/**
 * @fileOverview A recipe ingredient suggestion AI agent.
 *
 * - getIngredientsForDish - A function that suggests ingredients for a given dish.
 * - RecipeIngredientsInput - The input type for the getIngredientsForDish function.
 * - RecipeIngredientsOutput - The return type for the getIngredientsForDish function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RecipeIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish for which to get ingredients.'),
  language: z.string().describe("The language for the output ingredients (e.g., 'en', 'te')."),
});
export type RecipeIngredientsInput = z.infer<typeof RecipeIngredientsInputSchema>;

const RecipeIngredientsOutputSchema = z.object({
  ingredients: z.array(z.string()).describe('A list of ingredients for the dish.'),
  isSuccess: z.boolean().describe('Whether ingredients could be found for the dish.'),
  reason: z.string().describe('The reason for failure if isSuccess is false, or a success message if true.'),
});
export type RecipeIngredientsOutput = z.infer<typeof RecipeIngredientsOutputSchema>;

export async function getIngredientsForDish(input: RecipeIngredientsInput): Promise<RecipeIngredientsOutput> {
  return recipeIngredientsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recipeIngredientsPrompt',
  input: {schema: RecipeIngredientsInputSchema},
  output: {schema: RecipeIngredientsOutputSchema},
  prompt: `You are a master chef who knows the ingredients for any dish.
A user wants to know the ingredients for "{{dishName}}".

Provide a list of common ingredients for this dish.
The ingredients should be in the "{{language}}" language.

If you know the dish, set isSuccess to true and provide the ingredients.
If you do not recognize the dish, set isSuccess to false and set the reason to "Dish not found".
Do not include quantities, just the ingredient names.
`,
});

const recipeIngredientsFlow = ai.defineFlow(
  {
    name: 'recipeIngredientsFlow',
    inputSchema: RecipeIngredientsInputSchema,
    outputSchema: RecipeIngredientsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
