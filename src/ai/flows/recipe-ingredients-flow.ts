'use server';
/**
 * @fileOverview A flow to get ingredients for a recipe.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const RecipeIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish for which to get ingredients.'),
});

const RecipeIngredientsOutputSchema = z.object({
  ingredients: z.array(z.string()).describe('A list of ingredients for the dish.'),
});

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

export async function getIngredientsForRecipe(input: RecipeIngredientsInput): Promise<RecipeIngredientsOutput> {
    return recipeIngredientsFlow(input);
}
