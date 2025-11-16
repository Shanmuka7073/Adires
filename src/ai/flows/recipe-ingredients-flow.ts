
'use server';
/**
 * @fileOverview A flow to get ingredients for a recipe.
 * This file defines the Genkit flow and is intended for server-side use only.
 */
import { 
  RecipeIngredientsInputSchema,
  RecipeIngredientsOutputSchema,
  type RecipeIngredientsInput,
  type RecipeIngredientsOutput
} from './schemas';
import { Genkit } from 'genkit';

export const defineRecipeIngredientsFlow = (ai: Genkit) => {
    const getIngredientsPrompt = ai.definePrompt(
        {
            name: 'getIngredientsPrompt',
            model: 'gemini-2.5-flash',
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
            console.log('Calling Gemini API for new recipe.');
            const { output } = await getIngredientsPrompt(input);
            return output!;
        }
    );
    return recipeIngredientsFlow;
};

/**
 * An async function that runs the Genkit flow to get ingredients for a recipe.
 * This is the server action that the client will call.
 * @param input The dish name.
 * @returns A promise that resolves to the list of ingredients.
 */
export async function getIngredientsForRecipe(input: RecipeIngredientsInput): Promise<RecipeIngredientsOutput> {
    const { ai } = await import('@/ai/genkit');
    const flow = defineRecipeIngredientsFlow(ai);
    return flow(input);
}
