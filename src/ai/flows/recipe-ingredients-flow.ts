
'use server';
/**
 * @fileOverview An AI flow to get ingredients for a given dish.
 * This flow now first fetches from TheMealDB and then uses AI to parse.
 *
 * - getIngredientsForDish - A function that returns a structured recipe.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';
import { getMealDbRecipe } from '@/app/actions';
import {
  GetIngredientsInput,
  GetIngredientsInputSchema,
  GetIngredientsOutput,
  GetIngredientsOutputSchema,
} from './recipe-ingredients-types';

const ParsingPrompt = ai.definePrompt({
    name: 'recipeParsingPrompt',
    input: { schema: z.object({ 
        dishName: z.string(), 
        rawIngredients: z.array(z.string()),
        rawInstructions: z.string() 
    }) },
    output: { schema: GetIngredientsOutputSchema },
    model: googleAI.model('gemini-2.5-flash'),

    prompt: `You are an expert recipe parsing and formatting engine. Your task is to take a raw recipe and structure it perfectly.

Dish Name: {{dishName}}

Raw Ingredients:
{{#each rawIngredients}}
- {{this}}
{{/each}}

Raw Instructions:
"{{rawInstructions}}"

---

**Your Task:**

1.  **Parse Ingredients**: Clean up the ingredient list.
    *   For each item, create an object with \`name\` and \`quantity\`.
    *   Example: "1.5kg Chicken" becomes \`{ name: "Chicken", quantity: "1.5kg" }\`.
    *   If quantity is missing, use a sensible default like "to taste" or "1".

2.  **Parse Instructions**: Break down the raw instructions into logical, step-by-step blocks.
    *   For each block, create an object.
    *   The \`title\` should be a short, clear heading for the step (e.g., "Prepare the Marinade", "Cook the Onions").
    *   The \`actions\` should be an array of individual sentences describing what to do in that step.

3.  **Final Output**:
    *   Set \`isSuccess\` to true.
    *   Set \`title\` to the provided \`dishName\`.
    *   Return the final structured JSON.
`,
});


const getIngredientsFlow = ai.defineFlow(
  {
    name: 'getIngredientsFlow',
    inputSchema: GetIngredientsInputSchema,
    outputSchema: GetIngredientsOutputSchema,
  },
  async ({ dishName, language }) => {
    
    const mealDbResult = await getMealDbRecipe(dishName);

    if (mealDbResult.error || !mealDbResult.ingredients || !mealDbResult.instructions) {
      return {
        isSuccess: false,
        title: dishName,
        ingredients: [],
        instructions: [],
      };
    }

    const { output } = await ParsingPrompt({
        dishName: dishName,
        rawIngredients: mealDbResult.ingredients,
        rawInstructions: mealDbResult.instructions,
    });
    
    if (!output) {
      return { isSuccess: false, title: dishName, ingredients: [], instructions: [] };
    }

    return output;
  }
);

// Main exported function
export async function getIngredientsForDish(input: GetIngredientsInput): Promise<GetIngredientsOutput> {
  return await getIngredientsFlow(input);
}
