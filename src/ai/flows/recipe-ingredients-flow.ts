/**
 * @fileOverview A flow to get ingredients for a recipe.
 * This file defines the Genkit flow and is intended for server-side use only.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for the flow's input.
export const RecipeIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish for which to get ingredients.'),
});

// Define the schema for the flow's output.
export const RecipeIngredientsOutputSchema = z.object({
  ingredients: z.array(z.string()).describe('A list of ingredients for the dish.'),
});

// Infer the input and output types from the schemas.
export type RecipeIngredientsInput = z.infer<typeof RecipeIngredientsInputSchema>;
export type RecipeIngredientsOutput = z.infer<typeof RecipeIngredientsOutputSchema>;

const getIngredientsPrompt = ai.definePrompt(
  {
    name: 'getIngredientsPrompt',
    model: 'googleai/gemini-1.5-flash-latest',
    input: { schema: RecipeIngredientsInputSchema },
    output: { schema: RecipeIngredientsOutputSchema },
    prompt: `You are an expert chef. Provide a list of ingredients for the following dish: {{{dishName}}}.
    
    Please only list the core ingredients. Do not include quantities, measurements, or instructions.
    `,
  }
);

// This is the Genkit flow, which is not exported directly as it contains configuration.
export const recipeIngredientsFlow = ai.defineFlow(
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
