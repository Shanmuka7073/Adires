
'use server';
/**
 * @fileOverview A recipe ingredient and instruction generation AI agent that uses a Firestore cache.
 *
 * - getCompleteRecipe - A function that provides a full recipe for a given dish, checking cache first.
 * - RecipeInput - The input type for the getCompleteRecipe function.
 * - RecipeOutput - The return type for the getCompleteRecipe function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { getAdminServices } from '@/firebase/admin-init';
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const RecipeInputSchema = z.object({
  dishName: z.string().describe('The name of the dish for which to get a recipe.'),
  language: z.string().describe("The language for the output (e.g., 'en', 'te')."),
});
export type RecipeInput = z.infer<typeof RecipeInputSchema>;

const IngredientSchema = z.object({
    name: z.string().describe("The name of the ingredient."),
    quantity: z.string().describe("The quantity or measurement, e.g., '1 cup', '2 tsp', '100g'."),
});

const RecipeOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether a recipe could be found for the dish.'),
  reason: z.string().describe('The reason for failure if isSuccess is false, or a success message if true.'),
  ingredients: z.array(IngredientSchema).describe('A list of ingredients with their quantities.'),
  instructions: z.array(z.string()).describe('A list of step-by-step cooking instructions.'),
});
export type RecipeOutput = z.infer<typeof RecipeOutputSchema>;

// Internal caching functions using the admin SDK for trusted backend operations
const getCachedRecipeAdmin = async (db, dishName) => {
    const normalized = dishName.toLowerCase().replace(/\s+/g, '-');
    const docRef = doc(db, 'cachedRecipes', normalized);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        return { ingredients: data.ingredients, instructions: data.instructions };
    }
    return null;
}

const cacheRecipeAdmin = async (db, dishName, ingredients, instructions) => {
     const normalized = dishName.toLowerCase().replace(/\s+/g, '-');
     const docRef = doc(db, 'cachedRecipes', normalized);
     await setDoc(docRef, {
         id: normalized,
         dishName,
         ingredients,
         instructions,
         createdAt: serverTimestamp()
     });
}

const prompt = ai.definePrompt({
  name: 'recipeGeneratorPrompt',
  input: {schema: RecipeInputSchema},
  output: {schema: RecipeOutputSchema},
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are a master chef who provides clear, concise recipes.
A user wants the recipe for "{{dishName}}".

Your task is to provide:
1.  A list of common ingredients with their quantities (e.g., "1 cup", "200g", "3 tsp").
2.  A numbered list of simple, step-by-step cooking instructions.

The entire recipe (ingredients and instructions) should be in the "{{language}}" language.

If you recognize the dish, set isSuccess to true and provide the full recipe.
If you do not recognize the dish or it is not a food item, set isSuccess to false and set the reason to "Dish not found".
`,
});

export async function getCompleteRecipe(input: RecipeInput): Promise<RecipeOutput> {
  const { db } = await getAdminServices();

  // 1. Check cache first
  const cachedRecipe = await getCachedRecipeAdmin(db, input.dishName);
  if (cachedRecipe) {
      return {
          ...cachedRecipe,
          isSuccess: true,
          reason: 'Recipe successfully retrieved from cache.'
      };
  }

  // 2. If not in cache, call the AI model
  const { output } = await prompt(input);

  // 3. If the AI was successful, cache the result for next time
  if (output && output.isSuccess && output.ingredients.length > 0 && output.instructions.length > 0) {
      await cacheRecipeAdmin(db, input.dishName, output.ingredients, output.instructions);
  }
  
  return output!;
}
