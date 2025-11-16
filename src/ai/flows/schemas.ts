
/**
 * @fileOverview Shared Zod schemas and TypeScript types for AI flows.
 * This file does not contain server-side logic and can be safely imported by client components.
 */
import { z } from 'zod';

// --- Recipe Ingredients Flow ---
export const RecipeIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish for which to get ingredients.'),
});
export type RecipeIngredientsInput = z.infer<typeof RecipeIngredientsInputSchema>;

export const RecipeIngredientsOutputSchema = z.object({
  ingredients: z.array(z.string()).describe('A list of ingredients for the dish.'),
});
export type RecipeIngredientsOutput = z.infer<typeof RecipeIngredientsOutputSchema>;
