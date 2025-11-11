
/**
 * @fileOverview Shared Zod schemas and TypeScript types for AI flows.
 * This file does not contain server-side logic and can be safely imported by client components.
 */
import { z } from 'zod';

// --- General Question Flow ---
export const GeneralQuestionInputSchema = z.object({
  question: z.string().describe("The user's question."),
});
export type GeneralQuestionInput = z.infer<typeof GeneralQuestionInputSchema>;

export const GeneralQuestionOutputSchema = z.object({
  answer: z.string().describe("The AI's answer to the question."),
});
export type GeneralQuestionOutput = z.infer<typeof GeneralQuestionOutputSchema>;


// --- Recipe Ingredients Flow ---
export const RecipeIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish for which to get ingredients.'),
});
export type RecipeIngredientsInput = z.infer<typeof RecipeIngredientsInputSchema>;

export const RecipeIngredientsOutputSchema = z.object({
  ingredients: z.array(z.string()).describe('A list of ingredients for the dish.'),
});
export type RecipeIngredientsOutput = z.infer<typeof RecipeIngredientsOutputSchema>;


// --- Generate Pack Flow ---
export const GeneratePackInputSchema = z.object({
    packType: z.enum(['3-day', 'weekly', 'monthly']).describe("The duration of the pack."),
    familySize: z.number().int().positive().describe("The number of people in the family."),
    cuisine: z.string().optional().describe("Optional cuisine preference (e.g., 'South Indian', 'North Indian').")
});
export type GeneratePackInput = z.infer<typeof GeneratePackInputSchema>;

export const GeneratePackOutputSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("The name of the grocery item."),
      quantity: z.string().describe("The quantity needed, including units (e.g., '2kg', '500g', '1 packet').")
    })
  ).describe("A list of grocery items and their quantities for the pack.")
});
export type GeneratePackOutput = z.infer<typeof GeneratePackOutputSchema>;
