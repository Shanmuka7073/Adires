
'use server';
/**
 * @fileOverview A flow to get ingredients for a recipe.
 * This file defines the Genkit flow and is intended for server-side use only.
 */
import { 
  RecipeIngredientsInputSchema,
  RecipeIngredientsOutputSchema,
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

    ai.defineFlow(
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
};
