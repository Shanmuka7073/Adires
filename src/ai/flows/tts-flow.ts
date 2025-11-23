
'use server';
/**
 * @fileOverview An AI flow to generate speech from text using OpenAI's TTS model.
 *
 * - generateSpeech - A function that takes text and returns an audio data URI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

const GenerateSpeechOutputSchema = z.object({
  audioUrl: z
    .string()
    .describe(
      "The data URI of the generated audio. E.g., 'data:audio/mpeg;base64,...'"
    ),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;

export async function generateSpeech(
  input: GenerateSpeechInput
): Promise<GenerateSpeechOutput> {
  return generateSpeechFlow(input);
}

const generateSpeechFlow = ai.defineFlow(
  {
    name: 'generateSpeechFlow',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: 'openai/tts-1',
      prompt: input.text,
      config: {
        voice: 'alloy', // A standard, clear voice
      },
    });

    if (!media.url) {
      throw new Error('Speech generation failed to produce an audio URL.');
    }

    return { audioUrl: media.url };
  }
);
