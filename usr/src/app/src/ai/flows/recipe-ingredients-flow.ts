
'use server';
/**
 * @fileOverview A flow to get ingredients for a recipe.
 * This file defines the Genkit flow and is intended for server-side use only.
 */
import { ai } from '@/ai/genkit';
import type { 
  RecipeIngredientsInput,
  RecipeIngredientsOutput,
} from './schemas';
import { 
  RecipeIngredientsInputSchema,
  RecipeIngredientsOutputSchema,
} from './schemas';

// This is the new async wrapper function that can be safely exported.
export async function getIngredientsForRecipe(input: RecipeIngredientsInput): Promise<RecipeIngredientsOutput> {
  return await recipeIngredientsFlow(input);
}

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

// The `export` keyword is removed from here as it's not an async function.
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
