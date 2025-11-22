
'use server';
/**
 * @fileOverview A recipe ingredient suggestion AI agent that uses a Firestore cache.
 *
 * - getIngredientsForDish - A function that suggests ingredients for a given dish, checking cache first.
 * - RecipeIngredientsInput - The input type for the getIngredientsForDish function.
 * - RecipeIngredientsOutput - The return type for the getIngredientsForDish function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { getAdminServices } from '@/firebase/admin-init';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";


const RecipeIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish for which to get ingredients.'),
  language: z.string().describe("The language for the output ingredients (e.g., 'en', 'te')."),
});
export type RecipeIngredientsInput = z.infer<typeof RecipeIngredientsInputSchema>;

const RecipeIngredientsOutputSchema = z.object({
  ingredients: z.array(z.string()).describe('A list of ingredients for the dish.'),
  isSuccess: z.boolean().describe('Whether ingredients could be found for the dish.'),
  reason: z.string().describe('The reason for failure if isSuccess is false, or a success message if true.'),
});
export type RecipeIngredientsOutput = z.infer<typeof RecipeIngredientsOutputSchema>;

export async function getIngredientsForDish(input: RecipeIngredientsInput): Promise<RecipeIngredientsOutput> {
  return recipeIngredientsFlow(input);
}

// Internal caching functions using the admin SDK for trusted backend operations
const getCachedRecipeAdmin = async (db, dishName) => {
    const normalized = dishName.toLowerCase().replace(/\s+/g, '-');
    const docRef = doc(db, 'cachedRecipes', normalized);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data().ingredients;
    }
    return null;
}

const cacheRecipeAdmin = async (db, dishName, ingredients) => {
     const normalized = dishName.toLowerCase().replace(/\s+/g, '-');
     const docRef = doc(db, 'cachedRecipes', normalized);
     await setDoc(docRef, {
         id: normalized,
         dishName,
         ingredients,
         createdAt: serverTimestamp()
     });
}


const prompt = ai.definePrompt({
  name: 'recipeIngredientsPrompt',
  input: {schema: RecipeIngredientsInputSchema},
  output: {schema: RecipeIngredientsOutputSchema},
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are a master chef who knows the ingredients for any dish.
A user wants to know the ingredients for "{{dishName}}".

Provide a list of common ingredients for this dish.
The ingredients should be in the "{{language}}" language.

If you know the dish, set isSuccess to true and provide the ingredients.
If you do not recognize the dish, set isSuccess to false and set the reason to "Dish not found".
Do not include quantities, just the ingredient names.
`,
});

const recipeIngredientsFlow = ai.defineFlow(
  {
    name: 'recipeIngredientsFlow',
    inputSchema: RecipeIngredientsInputSchema,
    outputSchema: RecipeIngredientsOutputSchema,
  },
  async (input) => {
    const { db } = await getAdminServices();

    // 1. Check cache first
    const cachedIngredients = await getCachedRecipeAdmin(db, input.dishName);
    if (cachedIngredients) {
        return {
            ingredients: cachedIngredients,
            isSuccess: true,
            reason: 'Ingredients successfully retrieved from cache.'
        };
    }

    // 2. If not in cache, call the AI model
    const { output } = await prompt(input);

    // 3. If the AI was successful, cache the result for next time
    if (output && output.isSuccess && output.ingredients.length > 0) {
        await cacheRecipeAdmin(db, input.dishName, output.ingredients);
    }
    
    return output!;
  }
);
