
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

// New prompt to generate the recipe from scratch if TheMealDB fails.
const GenerationPrompt = ai.definePrompt({
    name: 'recipeGenerationPrompt',
    input: { schema: GetIngredientsInputSchema },
    output: { schema: GetIngredientsOutputSchema },
    model: googleAI.model('gemini-2.5-flash'),
    prompt: `You are an expert chef specializing in {{language}} cuisine.
Your task is to generate a complete, structured recipe for the dish: "{{dishName}}".

Instructions:
1.  **Generate Ingredients**: Create a realistic list of ingredients with quantities (e.g., "1 kg chicken", "2 medium onions").
2.  **Generate Instructions**: Write clear, step-by-step cooking instructions. Group them into logical steps, each with a short, imperative title (e.g., "Prepare the marinade", "Cook the onions").
3.  **Format Output**: Return the entire recipe in the specified JSON format. Ensure \`isSuccess\` is true.
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
2.  Translate each ingredient name. Keep the quantity the same.
3.  Translate each instruction step title.
4.  Translate each instruction action.
5.  Return the fully translated recipe in the specified JSON format. Ensure 'isSuccess' is true.`,
  });
  

const getIngredientsFlow = ai.defineFlow(
  {
    name: 'getIngredientsFlow',
    inputSchema: GetIngredientsInputSchema,
    outputSchema: GetIngredientsOutputSchema,
  },
  async ({ dishName, language, existingRecipe }) => {
    
    // If an existing recipe in another language is provided, translate it.
    if (existingRecipe) {
        console.log(`Translating recipe for "${dishName}" to ${language}.`);
        const { output: translatedOutput } = await TranslatePrompt({
            existingRecipe,
            targetLanguage: language || 'en',
        });
        if (translatedOutput) {
            return translatedOutput;
        }
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
            if (translatedOutput) return translatedOutput;
        }
        return output;
      }
    }

    // If TheMealDB fails, use the AI to generate the recipe from scratch.
    console.log(`TheMealDB failed for "${dishName}". Falling back to generative AI.`);
    const { output: generatedOutput } = await GenerationPrompt({ dishName, language });
    
    if (!generatedOutput) {
      return { isSuccess: false, title: dishName, ingredients: [], instructions: [] };
    }

    return generatedOutput;
  }
);

// Main exported function
export async function getIngredientsForDish(input: GetIngredientsInput): Promise<GetIngredientsOutput> {
  return await getIngredientsFlow(input);
}
