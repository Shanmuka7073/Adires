
'use server';
/**
 * @fileOverview An AI flow to get ingredients for a given dish.
 * This flow now first tries TheMealDB, and if that fails, it uses an
 * AI generation prompt as a fallback.
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
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { getAdminServices } from '@/firebase/admin-init'; // Correct server-side import


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

1.  **Parse Ingredients**: Clean up the ingredient list. For each ingredient, provide:
    *   \`name\`: The clean name of the ingredient (e.g., "Chicken").
    *   \`quantity\`: The full quantity string (e.g., "1.5kg", "2 medium").
    *   \`baseQuantity\`: The numeric value for a single serving (e.g., for "2 medium onions" this might be 2).
    *   \`unit\`: The unit of measurement (e.g., "kg", "g", "ml", "pc", "tsp"). If no unit, leave it blank.

2.  **Parse Instructions**: Break down the raw instructions into logical, step-by-step blocks.
    *   For each block, create a \`title\` (e.g., "Prepare the Marinade") and an array of \`actions\`.

3.  **Estimate Nutrition**: Provide a realistic estimate for \`calories\` and \`protein\` for a single serving of this dish.

4.  **Final Output**: Return the final structured JSON, with \`isSuccess\` set to true and a title for the dish.
`,
});

// New prompt to generate the recipe from scratch if TheMealDB fails.
const GenerationPrompt = ai.definePrompt({
    name: 'recipeGenerationPrompt',
    input: { schema: GetIngredientsInputSchema },
    output: { schema: GetIngredientsOutputSchema },
    model: googleAI.model('gemini-2.5-flash'),
    prompt: `You are an expert chef specializing in {{language}} cuisine.
Your task is to generate a complete, structured recipe for the dish: "{{dishName}}".

Instructions:
1.  **Generate Ingredients**: Create a realistic list of ingredients for a single serving. For each, specify the \`name\`, full \`quantity\` string, a numeric \`baseQuantity\`, and the \`unit\` (e.g., 'g', 'ml', 'pc').
2.  **Generate Instructions**: Write clear, step-by-step cooking instructions, grouped into logical steps with titles.
3.  **Estimate Nutrition**: Provide realistic \`calories\` and \`protein\` estimates for one serving.
4.  **Format Output**: Return the entire recipe in the specified JSON format. Ensure \`isSuccess\` is true and include a 'title' for the dish.
`,
});

const TranslatePrompt = ai.definePrompt({
    name: 'recipeTranslationPrompt',
    input: {
      schema: z.object({
        existingRecipe: GetIngredientsOutputSchema,
        targetLanguage: z.enum(['en', 'te']),
      }),
    },
    output: { schema: GetIngredientsOutputSchema },
    model: googleAI.model('gemini-2.5-flash'),
    prompt: `You are an expert culinary translator. Translate the following recipe for "{{existingRecipe.title}}" into {{targetLanguage}}.

**Source Ingredients:**
{{#each existingRecipe.ingredients}}
- {{name}} ({{quantity}})
{{/each}}

**Source Instructions:**
{{#each existingRecipe.instructions}}
### {{title}}
{{#each actions}}
- {{this}}
{{/each}}
{{/each}}

**Your Task:**
1.  Translate the dish title.
2.  Translate each ingredient name. Keep the quantity, baseQuantity, and unit the same.
3.  Translate each instruction step title and action.
4.  Keep the nutrition information the same.
5.  Return the fully translated recipe in the specified JSON format. Ensure 'isSuccess' is true.`,
  });
  

const getIngredientsFlow = ai.defineFlow(
  {
    name: 'getIngredientsFlow',
    inputSchema: GetIngredientsInputSchema,
    outputSchema: GetIngredientsOutputSchema,
  },
  async ({ dishName, language = 'en', existingRecipe }) => {
    
    // If an existing recipe in another language is provided, translate it.
    if (existingRecipe) {
        console.log(`Translating recipe for "${dishName}" to ${language}.`);
        const { output: translatedOutput } = await TranslatePrompt({
            existingRecipe,
            targetLanguage: language,
        });
        if (translatedOutput) {
            return translatedOutput;
        }
    }
    
    // Get Firestore admin instance for server-side operations
    const { db } = await getAdminServices();

    const cachedRecipe = await getCachedRecipe(db, dishName, language);
    if (cachedRecipe) {
        console.log(`Recipe for "${dishName}" in ${language} found in cache.`);
        return cachedRecipe;
    }


    // First, try to get the recipe from the external API.
    const mealDbResult = await getMealDbRecipe(dishName);

    if (!mealDbResult.error && mealDbResult.ingredients && mealDbResult.instructions) {
      // If successful, use the AI to parse the result.
      const { output } = await ParsingPrompt({
          dishName: dishName,
          rawIngredients: mealDbResult.ingredients,
          rawInstructions: mealDbResult.instructions,
      });
      if (output) {
        // If the requested language is not English, translate the parsed result.
        if (language && language !== 'en') {
            const { output: translatedOutput } = await TranslatePrompt({
                existingRecipe: output,
                targetLanguage: language,
            });
            if (translatedOutput) {
                 await cacheRecipe(db, dishName, language, translatedOutput);
                 return translatedOutput;
            }
        }
        await cacheRecipe(db, dishName, language, output);
        return output;
      }
    }

    // If TheMealDB fails, use the AI to generate the recipe from scratch.
    console.log(`TheMealDB failed for "${dishName}". Falling back to generative AI.`);
    const { output: generatedOutput } = await GenerationPrompt({ dishName, language });
    
    if (!generatedOutput) {
      return { isSuccess: false, title: dishName, ingredients: [], instructions: [], nutrition: { calories: 0, protein: 0 } };
    }

    // Cache the newly generated recipe
    await cacheRecipe(db, dishName, language, generatedOutput);

    return generatedOutput;
  }
);

// Main exported function
export async function getIngredientsForDish(input: GetIngredientsInput): Promise<GetIngredientsOutput> {
  return await getIngredientsFlow(input);
}
