
/**
 * @fileOverview Type and schema definitions for the recipe ingredients AI flow.
 * This file is separate from the flow itself to avoid exporting non-function
 * values from a 'use server' file.
 */

import { z } from 'zod';

const IngredientSchema = z.object({
    name: z.string().describe('The name of the ingredient.'),
    quantity: z.string().describe('The quantity and unit (e.g., "1 cup", "200g").'),
});

const InstructionStepSchema = z.object({
    title: z.string().describe("A short, imperative-verb title for the step (e.g., 'Marinate the Chicken', 'Cook the Rice')."),
    actions: z.array(z.string()).describe("A list of individual actions to perform in this step."),
});

export const GetIngredientsOutputSchema = z.object({
    isSuccess: z.boolean().describe('Whether ingredients were successfully found.'),
    title: z.string().describe('The official or common name of the dish.'),
    ingredients: z.array(IngredientSchema).describe('An array of ingredients.'),
    instructions: z.array(InstructionStepSchema).describe('An array of step-by-step instructions.'),
});
export type GetIngredientsOutput = z.infer<typeof GetIngredientsOutputSchema>;

// Define Zod schemas for structured input and output
export const GetIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish to get ingredients for (e.g., "Chicken Biryani").'),
  language: z.enum(['en', 'te']).optional().describe("The desired language for the recipe (e.g., 'en' for English, 'te' for Telugu). Defaults to 'en'."),
  existingRecipe: GetIngredientsOutputSchema.optional().describe("An optional existing recipe in another language to be translated."),
});
export type GetIngredientsInput = z.infer<typeof GetIngredientsInputSchema>;

