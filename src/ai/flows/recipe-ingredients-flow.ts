
'use server';
/**
 * @fileOverview A flow to get ingredients for a recipe.
 *
 * - getIngredientsForRecipe - An async function to get ingredients for a given dish.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for the flow's input. This is not exported.
const RecipeIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish for which to get ingredients.'),
});

// Define the schema for the flow's output. This is not exported.
const RecipeIngredientsOutputSchema = z.object({
  ingredients: z.array(z.string()).describe('A list of ingredients for the dish.'),
});

// Infer the input and output types for use within this file.
export type RecipeIngredientsInput = z.infer<typeof RecipeIngredientsInputSchema>;
export type RecipeIngredientsOutput = z.infer<typeof RecipeIngredientsOutputSchema>;


const getIngredientsPrompt = ai.definePrompt(
  {
    name: 'getIngredientsPrompt',
    input: { schema: RecipeIngredientsInputSchema },
    output: { schema: RecipeIngredientsOutputSchema },
    prompt: `You are an expert chef. Provide a list of ingredients for the following dish: {{{dishName}}}.
    
    Please only list the core ingredients. Do not include quantities, measurements, or instructions.
    `,
  }
);

const recipeIngredientsFlow = ai.defineFlow(
  {
    name: 'recipeIngredientsFlow',
    inputSchema: RecipeIngredientsInputSchema,
    outputSchema: RecipeIngredientsOutputSchema,
  },
  async (input) => {
    const { output } = await getIngredientsPrompt(input);
    return output!;
  }
);

/**
 * An async function that runs the Genkit flow to get ingredients for a recipe.
 * This is the only function exported from this server module.
 * @param input The dish name.
 * @returns A promise that resolves to the list of ingredients.
 */
export async function getIngredientsForRecipe(input: RecipeIngredientsInput): Promise<RecipeIngredientsOutput> {
    return recipeIngredientsFlow(input);
}
