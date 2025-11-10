
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const RecipeIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish for which to get ingredients.'),
});

const RecipeIngredientsOutputSchema = z.object({
  ingredients: z.array(z.string()).describe('The list of ingredients for the dish.'),
});

export type RecipeIngredientsInput = z.infer<typeof RecipeIngredientsInputSchema>;
export type RecipeIngredientsOutput = z.infer<typeof RecipeIngredientsOutputSchema>;

// Define the prompt for the AI model
const recipePrompt = ai.definePrompt({
  name: 'recipeIngredientsPrompt',
  input: { schema: RecipeIngredientsInputSchema },
  output: { schema: RecipeIngredientsOutputSchema },
  prompt: `You are a helpful recipe assistant. Provide a list of ingredients for the dish: {{{dishName}}}.`,
});


export async function getRecipeIngredients(input: RecipeIngredientsInput): Promise<RecipeIngredientsOutput> {
  const { firestore } = initializeFirebase();
  const dishId = input.dishName.toLowerCase().replace(/\s+/g, '-');
  const cacheRef = doc(firestore, 'cachedRecipes', dishId);

  try {
    const cachedSnap = await getDoc(cacheRef);
    if (cachedSnap.exists()) {
      console.log('Returning cached recipe for:', input.dishName);
      return { ingredients: cachedSnap.data().ingredients };
    }
  } catch (e) {
    console.error('Failed to access Firestore cache, proceeding with AI call.', e);
  }

  console.log('Fetching new recipe from AI for:', input.dishName);
  const { output } = await recipePrompt(input);
  
  if (output) {
    try {
        await setDoc(cacheRef, {
            id: dishId,
            dishName: input.dishName,
            ingredients: output.ingredients,
            createdAt: new Date().toISOString(),
        });
    } catch(e) {
        console.error('Failed to cache recipe in Firestore.', e);
    }
    return output;
  }
  
  return { ingredients: [] };
}
