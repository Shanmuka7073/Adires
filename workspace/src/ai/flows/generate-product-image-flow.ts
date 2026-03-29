'use server';
/**
 * @fileOverview An AI flow to generate an image for a product.
 *
 * - generateProductImage - Generates an image based on a product name.
 * - GenerateProductImageInput - The input type for the flow.
 * - GenerateProductImageOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const GenerateProductImageInputSchema = z.object({
  productName: z.string().describe('The name of the grocery product to generate an image for.'),
});
export type GenerateProductImageInput = z.infer<typeof GenerateProductImageInputSchema>;

const GenerateProductImageOutputSchema = z.object({
  imageUrl: z.string().describe("The data URI of the generated image. E.g., 'data:image/png;base64,...'"),
});
export type GenerateProductImageOutput = z.infer<typeof GenerateProductImageOutputSchema>;

export async function generateProductImage(input: GenerateProductImageInput): Promise<GenerateProductImageOutput> {
  return generateProductImageFlow(input);
}

const generateProductImageFlow = ai.defineFlow(
  {
    name: 'generateProductImageFlow',
    inputSchema: GenerateProductImageInputSchema,
    outputSchema: GenerateProductImageOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: googleAI.model('imagen-4.0-fast-generate-001'),
      prompt: `a high-quality, professional photograph of a single grocery item: "${input.productName}". The item should be centered on a clean, plain white background. Studio lighting.`,
    });

    if (!media || !media.url) {
      throw new Error('Image generation failed to produce a valid media object or URL.');
    }

    return { imageUrl: media.url };
  }
);
