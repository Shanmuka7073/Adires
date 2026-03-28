
/**
 * @fileOverview An AI flow to provide detailed information about a product or service.
 */

import { getAdminServices } from '@/firebase/admin-init';
import { ai } from '@/ai/genkit';
import { GetIngredientsInputSchema, GetIngredientsOutputSchema } from './recipe-ingredients-types';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import type { GetIngredientsOutput } from './recipe-ingredients-types';

export async function getIngredientsForDishFlow(input: { dishName: string; language: 'en' | 'te', existingRecipe?: GetIngredientsOutput }): Promise<GetIngredientsOutput> {
  const { db } = getAdminServices();
  
  const language = input.language || 'en';

  // 1. Check cache first
  const cachedData = await getCachedRecipe(db, input.dishName, language);
  if (cachedData) {
    return cachedData as any;
  }
  
  // 2. Define and run the prompt
  const prompt = ai.definePrompt({
    name: 'recipeIngredientsPrompt',
    input: { schema: GetIngredientsInputSchema },
    output: { schema: GetIngredientsOutputSchema },
    model: 'googleai/gemini-2.5-flash',
    prompt: `
        You are an expert consultant for an Indian hyperlocal marketplace.
        Your task is to provide detailed information about a product or service.

        **Item Name**: {{{dishName}}}
        **Desired Language**: {{{language}}}

        {{#if existingRecipe}}
        **Translate This Information**:
        You have been provided with existing details. Your main goal is to accurately translate the title, components (ingredients/materials), and steps into the desired language ({{{language}}}).

        Existing Title: {{{existingRecipe.title}}}
        {{else}}
        **Generate New Details**:
        1.  **Analyze the Item**: Determine if "{{dishName}}" is a **food** dish, a **service** (like salon, plumbing, cleaning), or a physical **product**.
        2.  **Set itemType**: Categorize it correctly as 'food', 'service', or 'product'.
        3.  **Generate Components**: 
            - For food: List the ingredients.
            - For services: List the materials or equipment used (e.g., scissors, shampoo, massage oil).
            - Provide name, display quantity (e.g., "500g", "As needed"), and base unit.
        4.  **Generate Steps**: Provide clear, step-by-step instructions or stages of the service.
        5.  **Nutrition (Food Only)**: If it is food, estimate calories and protein. Otherwise, set both to 0.
        6.  **Set Title**: Use the official or most common name for the item.
        7.  **Success Flag**: Set 'isSuccess' to true if you can provide meaningful details.
        8.  **Language**: All output must be in the desired language: {{{language}}}.
        {{/if}}

        If the item name is ambiguous or unknown, try your best to describe it based on common knowledge.
        `,
  });

  const { output } = await prompt({ ...input, language });
  
  // 3. Cache result
  if (output && output.isSuccess) {
    await cacheRecipe(db, input.dishName, language, output as any);
    return output;
  }
  
  return {
      isSuccess: false,
      itemType: 'product',
      title: input.dishName,
      components: [],
      steps: [],
      nutrition: { calories: 0, protein: 0 },
  };
}
