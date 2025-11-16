
/**
 * @fileOverview Shared Zod schemas and TypeScript types for AI flows.
 * This file does not contain server-side logic and can be safely imported by client components.
 */
import { z } from 'zod';

// --- Recipe Ingredients Flow ---
export const RecipeIngredientsInputSchema = z.object({
  dishName: z.string().describe('The name of the dish for which to get ingredients.'),
});
export type RecipeIngredientsInput = z.infer<typeof RecipeIngredientsInputSchema>;

export const RecipeIngredientsOutputSchema = z.object({
  ingredients: z.array(z.string()).describe('A list of ingredients for the dish.'),
});
export type RecipeIngredientsOutput = z.infer<typeof RecipeIngredientsOutputSchema>;

// --- General Question Flow ---
export const GeneralQuestionInputSchema = z.object({
  question: z.string().describe('The user\'s general knowledge question.'),
});
export type GeneralQuestionInput = z.infer<typeof GeneralQuestionInputSchema>;

export const GeneralQuestionOutputSchema = z.object({
  answer: z.string().describe('The AI\'s answer to the general question.'),
});
export type GeneralQuestionOutput = z.infer<typeof GeneralQuestionOutputSchema>;

// --- Generate Pack Flow ---
export const GeneratePackInputSchema = z.object({
  packType: z.enum(['3-day', 'weekly', 'monthly']).describe('The duration for the grocery pack.'),
  familySize: z.number().int().positive().describe('The number of people in the family.'),
});
export type GeneratePackInput = z.infer<typeof GeneratePackInputSchema>;

export const GeneratePackOutputSchema = z.object({
  items: z.array(z.object({
    name: z.string().describe('The name of the grocery item.'),
    quantity: z.string().describe('The quantity of the item (e.g., "1 kg", "2 packets").'),
  })).describe('A list of grocery items for the pack.'),
});
export type GeneratePackOutput = z.infer<typeof GeneratePackOutputSchema>;

// --- Alias Target Suggestion Flow ---
export const AliasTargetSuggestionInputSchema = z.object({
    failedCommand: z.string().describe("The voice command that the user spoke which the system failed to understand."),
    language: z.string().describe("The language of the failed command (e.g., 'en', 'te')."),
    possibleTargets: z.array(
        z.object({
            key: z.string().describe("The unique identifier for the target (e.g., 'tomatoes' or 'go-to-cart')."),
            display: z.string().describe("The user-friendly display name for the target."),
            type: z.enum(['product', 'store', 'command']).describe("The category of the target."),
            aliases: z.array(z.string()).describe("A list of existing known aliases for this target."),
        })
    ).describe("A list of all possible items (products, stores, commands) that the failed command could map to."),
});
export type AliasTargetSuggestionInput = z.infer<typeof AliasTargetSuggestionInputSchema>;

export const AliasTargetSuggestionOutputSchema = z.object({
  suggestedTargetKey: z.string().optional().describe("The key of the target that the AI suggests is the best match for the failed command. If no good match is found, this can be null or undefined."),
  reasoning: z.string().describe("A brief explanation for why the AI chose this target, or why it couldn't find a match."),
});
export type AliasTargetSuggestionOutput = z.infer<typeof AliasTargetSuggestionOutputSchema>;
