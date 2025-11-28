
'use server';
/**
 * @fileOverview An AI flow to get a list of ingredients for a recipe.
 *
 * - getIngredientsForDish - A function that gets ingredients for a given dish.
 * - GetIngredientsInput - The input type for the flow.
 * - GetIngredientsOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import type { InstructionStep } from '@/lib/types';


const GetIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish to get ingredients for.'),
  language: z.string().describe("The language for the output ingredients list (e.g., 'English', 'Telugu')."),
});
export type GetIngredientsInput = z.infer<typeof GetIngredientsInputSchema>;

const IngredientSchema = z.object({
    name: z.string().describe('The name of the ingredient.'),
    quantity: z.string().describe('The quantity required for the ingredient (e.g., "1kg", "2 cups").'),
});

const InstructionStepSchema = z.object({
    title: z.string().describe("The numbered heading for this step (e.g., '1. Marinate the Chicken')."),
    actions: z.array(z.string()).describe("A list of bullet-point actions for this step."),
});

const GetIngredientsOutputSchema = z.object({
    isSuccess: z.boolean().describe("Whether the ingredients were found successfully."),
    ingredients: z.array(IngredientSchema).describe('An array of objects, where each object has a "name" and "quantity" property for the ingredient.'),
    instructions: z.array(InstructionStepSchema).describe("An array of step-by-step cooking instructions."),
    title: z.string().describe("The official name of the dish in the requested language."),
});
export type GetIngredientsOutput = z.infer<typeof GetIngredientsOutputSchema>;

export async function getIngredientsForDish(input: GetIngredientsInput): Promise<GetIngredientsOutput> {
  return getIngredientsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'getIngredientsPrompt',
    input: { schema: GetIngredientsInputSchema },
    output: { schema: GetIngredientsOutputSchema },
    model: googleAI.model('gemini-2.5-flash'),
    prompt: `You are a master chef. A user wants to know the full recipe for a dish.
    
Dish: "{{dishName}}"

Provide the following in the user's requested language of '{{language}}':
1.  **ingredients**: A list of all main ingredients. Each ingredient MUST be an object with a 'name' and a 'quantity' property (e.g., { "name": "Chicken", "quantity": "1 kg" }).
2.  **instructions**: A structured array of the complete, step-by-step cooking instructions. Each object in the array should represent one main step and have a 'title' (e.g., "1. Prepare the Rice") and an array of 'actions' for that step.
3.  **title**: The official title of the dish.

If you do not know the recipe or it is not a food item, set isSuccess to false and return empty arrays and strings.`,
});


const getIngredientsFlow = ai.defineFlow(
  {
    name: 'getIngredientsFlow',
    inputSchema: GetIngredientsInputSchema,
    outputSchema: GetIngredientsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);

    if (!output) {
        return { isSuccess: false, ingredients: [], instructions: [], title: '' };
    }
    
    return output;
  }
);
