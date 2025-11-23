
'use server';
/**
 * @fileOverview An AI flow to generate speech from text using OpenAI's TTS model.
 *
 * - generateSpeech - A function that takes text and returns an audio data URI.
 */

import OpenAI from 'openai';
import { z } from 'zod';

// Initialize the OpenAI client directly.
// The API key is automatically read from the OPENAI_API_KEY environment variable.
const openai = new OpenAI();

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
  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: input.text,
    });

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const base64Audio = audioBuffer.toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
    
    return { audioUrl };

  } catch (error) {
    console.error('OpenAI Speech Generation Failed:', error);
    throw new Error('Speech generation failed.');
  }
}
