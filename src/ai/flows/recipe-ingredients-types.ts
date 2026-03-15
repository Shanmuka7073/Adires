
/**
 * @fileOverview Type and schema definitions for the item details AI flow.
 * This file is separate from the flow itself to avoid exporting non-function
 * values from a 'use server' file.
 */

import { z } from 'zod';

const ComponentSchema = z.object({
    name: z.string().describe('The name of the ingredient or material used.'),
    quantity: z.string().describe('The display quantity and unit (e.g., "1 cup", "200g", "As needed").'),
    baseQuantity: z.number().optional().describe('The numeric quantity for a single unit (e.g., 200).'),
    unit: z.string().optional().describe('The unit of measurement (e.g., "g", "ml", "pcs").'),
    cost: z.number().optional().describe("The estimated cost for the specified quantity in Indian Rupees (₹)."),
});

const StepSchema = z.object({
    title: z.string().describe("A short, imperative-verb title for the step (e.g., 'Apply Shampoo', 'Marinate the Chicken')."),
    actions: z.array(z.string()).describe("A list of individual actions to perform in this step."),
});

const NutritionSchema = z.object({
    calories: z.number().describe('Estimated total calories for a single serving. Set to 0 for non-food items.'),
    protein: z.number().describe('Estimated grams of protein for a single serving. Set to 0 for non-food items.'),
});

export const GetIngredientsOutputSchema = z.object({
    isSuccess: z.boolean().describe('Whether details were successfully generated.'),
    itemType: z.enum(['food', 'service', 'product']).describe('The type of item being described.'),
    title: z.string().describe('The official or common name of the item.'),
    components: z.array(ComponentSchema).describe('An array of ingredients, materials, or equipment used.'),
    steps: z.array(StepSchema).describe('An array of step-by-step instructions or service stages.'),
    nutrition: NutritionSchema.optional().describe('Estimated nutritional information. Only applicable for food.'),
});
export type GetIngredientsOutput = z.infer<typeof GetIngredientsOutputSchema>;

// Define Zod schemas for structured input and output
export const GetIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the item or service to get details for (e.g., "Chicken Biryani", "Hair Cut").'),
  language: z.enum(['en', 'te']).optional().describe("The desired language for the details. Defaults to 'en'."),
  existingRecipe: GetIngredientsOutputSchema.optional().describe("An optional existing details object in another language to be translated."),
});
export type GetIngredientsInput = z.infer<typeof GetIngredientsInputSchema>;
