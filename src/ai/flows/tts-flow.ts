
'use server';
/**
 * @fileOverview An AI flow to generate speech from text using OpenAI.
 *
 * - generateSpeech - A function that converts text to speech.
 * - GenerateSpeechInput - The input type for the flow.
 * - GenerateSpeechOutput - The return type for the flow.
 */

import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to convert to speech.'),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy').describe('The voice to use for the speech.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

const GenerateSpeechOutputSchema = z.object({
  audio: z.string().describe("The base64 encoded audio data as a data URI."),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;


export async function generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput> {
  try {
    const result = await openai.audio.speech.create({
      model: "tts-1",
      voice: input.voice,
      input: input.text,
    });

    const audioBuffer = Buffer.from(await result.arrayBuffer());
    const base64Audio = audioBuffer.toString('base64');
    const dataUri = `data:audio/mpeg;base64,${base64Audio}`;

    return { audio: dataUri };

  } catch (error) {
    console.error("OpenAI TTS Error in flow:", error);
    throw new Error("Voice generation failed.");
  }
}
