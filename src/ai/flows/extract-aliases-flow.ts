
'use server';
/**
 * @fileOverview An AI flow to extract potential product aliases from a block of text.
 *
 * - extractAliasesFromText - A function that analyzes text and suggests new voice aliases for existing products.
 * - ExtractAliasesInput - The input type for the flow.
 * - ExtractAliasesOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const ExtractAliasesInputSchema = z.object({
  textBlock: z.string().describe('A block of text to analyze for product aliases (e.g., from a book, article, or recipe).'),
  existingProducts: z.array(z.string()).describe('A list of canonical product names that already exist in the system (e.g., ["Toor Dal", "Onions"]).'),
});
export type ExtractAliasesInput = z.infer<typeof ExtractAliasesInputSchema>;

const AliasSuggestionSchema = z.object({
    productName: z.string().describe("The existing canonical product name this alias should be linked to."),
    suggestedAlias: z.string().describe("The new alias discovered in the text."),
    context: z.string().describe("A short sentence or phrase from the source text showing how the alias was used."),
    confidence: z.number().min(0).max(1).describe("A score from 0.0 to 1.0 indicating the confidence that this is a valid alias."),
});

const ExtractAliasesOutputSchema = z.object({
  suggestions: z.array(AliasSuggestionSchema).describe('A list of potential aliases found in the text.'),
});
export type ExtractAliasesOutput = z.infer<typeof ExtractAliasesOutputSchema>;

export async function extractAliasesFromText(input: ExtractAliasesInput): Promise<ExtractAliasesOutput> {
  return extractAliasesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractAliasesPrompt',
  input: {schema: ExtractAliasesInputSchema},
  output: {schema: ExtractAliasesOutputSchema},
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are a linguistic analysis engine for a grocery application. Your task is to read a block of text and discover new aliases (synonyms, regional names, or common misspellings) for a known list of grocery products.

Here is the list of existing canonical product names:
{{#each existingProducts}}
- {{this}}
{{/each}}

Here is the text block to analyze:
---
"{{textBlock}}"
---

1.  **Analyze the Text**: Read through the text and identify any words or phrases that are likely synonyms for the existing products. For example, if "Toor Dal" is an existing product, you might find "Kandi Pappu" or "Arhar dal" in the text.
2.  **Extract Suggestions**: For each potential alias you find, create a suggestion object.
    *   \`productName\`: The canonical product name from the provided list that the alias refers to.
    *   \`suggestedAlias\`: The new alias you discovered.
    *   \`context\`: The direct sentence or phrase from the text where you found the alias. This is crucial for verification.
    *   \`confidence\`: Your confidence score (0.0 to 1.0) that this is a correct and useful alias. Be critical. A direct statement like "X is also known as Y" should have high confidence (e.g., 0.9). A contextual guess should be lower (e.g., 0.6).
3.  **Formatting**:
    *   Do not suggest an alias that is identical to the product name.
    *   Do not suggest aliases that are too generic (e.g., 'item', 'vegetable').
    *   If no suggestions are found, return an empty 'suggestions' array.
`,
});

const extractAliasesFlow = ai.defineFlow(
  {
    name: 'extractAliasesFlow',
    inputSchema: ExtractAliasesInputSchema,
    outputSchema: ExtractAliasesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output || { suggestions: [] };
  }
);
