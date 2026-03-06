
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { ai } from '@/ai/genkit';
import { GetIngredientsInputSchema, GetIngredientsOutputSchema } from './recipe-ingredients-types';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import type { GetIngredientsOutput } from './recipe-ingredients-types';

const prompt = ai.definePrompt(
  {
    name: 'recipeIngredientsPrompt',
    input: { schema: GetIngredientsInputSchema },
    output: { schema: GetIngredientsOutputSchema },
    model: 'googleai/gemini-2.5-flash',
    prompt: `
        You are an expert chef and nutritionist for an Indian grocery app.
        Your primary task is to generate a list of ingredients, step-by-step instructions, and nutritional information for any given dish.

        **Dish Name**: {{{dishName}}}
        **Desired Language**: {{{language}}}

        {{#if existingRecipe}}
        **Translate This Recipe**:
        You have been provided with an existing recipe. Your main goal is to accurately translate its ingredients, instructions, and title into the desired language ({{{language}}}). Do not change the quantities or the core steps.

        Existing Dish Name: {{{existingRecipe.title}}}
        Existing Ingredients:
        {{#each existingRecipe.ingredients}}
        - {{this.name}} ({{this.quantity}})
        {{/each}}
        Existing Instructions:
        {{#each existingRecipe.instructions}}
        **{{this.title}}**: {{this.actions}}
        {{/each}}
        {{else}}
        **Generate New Recipe**:
        1.  **Analyze the Dish**: Identify the core components of "{{dishName}}".
        2.  **Generate Ingredients**: Create a list of all necessary ingredients. For each, provide:
            *   \`name\`: The common name of the ingredient.
            *   \`quantity\`: A user-friendly display quantity (e.g., "200g", "1 cup", "2 medium-sized").
            *   \`baseQuantity\`: A numeric quantity for a base unit (e.g., for "1 cup flour", this might be 120).
            *   \`unit\`: The base unit ('g', 'ml', 'pcs').
        3.  **Generate Instructions**: Provide clear, step-by-step cooking instructions. Group actions into logical steps, each with a short, imperative title (e.g., 'Marinate the Chicken').
        4.  **Estimate Nutrition**: Provide estimated calories and protein per serving.
        5.  **Set Title**: Provide the official, well-known name of the dish.
        6.  **Success Flag**: Set 'isSuccess' to true.
        7.  **Language**: All output (names, descriptions, instructions) must be in the desired language: {{{language}}}.
        {{/if}}

        If the dish name is not a valid or known dish, set 'isSuccess' to false and return empty arrays for ingredients and instructions.
        `,
  }
);


// This function is the AI flow that will be called by the Server Action
export async function getIngredientsForDishFlow(input: { dishName: string; language: 'en' | 'te', existingRecipe?: GetIngredientsOutput }): Promise<GetIngredientsOutput> {
  const { db } = await getAdminServices();
  
  // 1. Check cache first
  const cachedData = await getCachedRecipe(db, input.dishName, input.language);
  if (cachedData) {
    return cachedData;
  }
  
  // 2. If not in cache, call the AI
  const { output } = await prompt(input);
  
  // 3. If AI call is successful, cache the new recipe for future use
  if (output && output.isSuccess) {
    await cacheRecipe(db, input.dishName, input.language, output);
  } else if (!output) {
      return {
          isSuccess: false,
          title: input.dishName,
          ingredients: [],
          instructions: [],
          nutrition: { calories: 0, protein: 0 },
      };
  }
  
  return output;
}
