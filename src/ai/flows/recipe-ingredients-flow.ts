
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getCachedRecipe, setCachedRecipe } from '@/lib/recipe-cache';
import { getMasterProducts } from '@/lib/data';
import { initServerApp } from '@/firebase/server-init';

const IngredientSchema = z.object({
  name: z.string().describe('The name of the ingredient, e.g., "all-purpose flour"'),
  quantity: z.string().describe('The quantity, including units, e.g., "2 cups"'),
});

const RecipeIngredientsSchema = z.object({
  dishName: z.string().describe('The name of the dish requested by the user.'),
  ingredients: z.array(IngredientSchema).describe('A list of all ingredients for the dish.'),
});

export type RecipeIngredients = z.infer<typeof RecipeIngredientsSchema>;

export async function getIngredientsForRecipe(
  dishName: string
): Promise<RecipeIngredients | null> {
  const { firestore } = await initServerApp();
  // No caching logic for now, directly call the AI flow.
  return recipeIngredientsFlow(dishName);
}

const recipeIngredientsFlow = ai.defineFlow(
  {
    name: 'recipeIngredientsFlow',
    inputSchema: z.string(),
    outputSchema: RecipeIngredientsSchema,
  },
  async (dishName) => {
    const { firestore } = await initServerApp();
    const masterProducts = await getMasterProducts(firestore);
    const productList = masterProducts.map(p => p.name).join(', ');

    const prompt = `You are a master chef. The user wants to cook a dish called "${dishName}".

      Your task is to provide a list of ingredients required to make this dish.
      
      Analyze the user's request and cross-reference with the following list of available grocery products:
      [${productList}]

      If an ingredient is a variation of an available product (e.g., "chickpea flour" vs "Besan Flour"), use the available product's name.
      Be precise with quantities and units. If a quantity isn't specified for an ingredient, make a reasonable assumption (e.g., "1 bunch" for coriander).
      
      Return the result in the specified JSON format.`;

    const { output } = await ai.generate({
      prompt,
      model: 'googleai/gemini-1.5-flash-latest',
      output: {
        schema: RecipeIngredientsSchema,
      },
    });

    return output;
  }
);
