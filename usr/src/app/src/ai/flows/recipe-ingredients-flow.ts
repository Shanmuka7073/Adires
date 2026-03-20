'use server';
/**
 * @fileOverview An AI flow to extract components and steps for a product or service.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAdminServices } from '@/firebase/admin-init';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import type { GetIngredientsOutput } from '@/lib/types';

const ComponentSchema = z.object({
    name: z.string().describe('The name of the ingredient or material.'),
    quantity: z.string().describe('Display quantity (e.g., "1 cup", "200g").'),
});

const StepSchema = z.object({
    title: z.string().describe('Imperative title for the step.'),
    actions: z.array(z.string()).describe('List of actions for this step.'),
});

const RecipeOutputSchema = z.object({
    isSuccess: z.boolean(),
    itemType: z.enum(['food', 'service', 'product']),
    title: z.string(),
    components: z.array(ComponentSchema),
    steps: z.array(StepSchema),
});

export async function getIngredientsForDishFlow(input: { dishName: string; language: string }): Promise<GetIngredientsOutput> {
    const { db } = await getAdminServices();
    const lang = (input.language || 'en') as 'en' | 'te';

    const cached = await getCachedRecipe(db, input.dishName, lang);
    if (cached) return cached;

    const { output } = await ai.generate({
        model: 'googleai/gemini-1.5-flash',
        prompt: `Provide details for: ${input.dishName} in ${input.language}. Return as JSON with itemType (food/service/product), title, components (name, quantity), and steps (title, actions).`,
        output: { schema: RecipeOutputSchema },
    });

    const result = output || { isSuccess: false, itemType: 'product', title: input.dishName, components: [], steps: [] };
    
    if (result.isSuccess) {
        await cacheRecipe(db, input.dishName, lang, result as any);
    }

    return result as GetIngredientsOutput;
}
