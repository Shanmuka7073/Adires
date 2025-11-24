
'use server';
/**
 * @fileOverview An AI flow to generate a natural-sounding voice reply in a specific dialect.
 *
 * - generateVoiceReply - A function that converts text to speech with a specific accent.
 * - GenerateVoiceInput - The input type for the flow.
 * - GenerateVoiceOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';
import wav from 'wav';

const GenerateVoiceInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  language: z.enum(['en', 'te', 'hi']).describe('The language of the text.'),
});
export type GenerateVoiceInput = z.infer<typeof GenerateVoiceInputSchema>;

const GenerateVoiceOutputSchema = z.object({
  audioDataUri: z.string().describe("The generated audio as a data URI in WAV format. E.g., 'data:audio/wav;base64,...'"),
});
export type GenerateVoiceOutput = z.infer<typeof GenerateVoiceOutputSchema>;


async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}


const generateVoiceReplyFlow = ai.defineFlow(
  {
    name: 'generateVoiceReplyFlow',
    inputSchema: GenerateVoiceInputSchema,
    outputSchema: GenerateVoiceOutputSchema,
  },
  async (input) => {
    // The prompt should ONLY contain the text to be synthesized.
    const prompt = input.text;

    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            // This voice is chosen for its suitability for Indian accents.
            // Achernar is a female voice.
            prebuiltVoiceConfig: { voiceName: 'Achernar' },
          },
        },
      },
      prompt,
    });

    if (!media || !media.url) {
      throw new Error('TTS generation failed to produce audio.');
    }
    
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );
    
    const wavBase64 = await toWav(audioBuffer);

    return { audioDataUri: 'data:audio/wav;base64,' + wavBase64 };
  }
);


export async function generateVoiceReply(input: GenerateVoiceInput): Promise<GenerateVoiceOutput> {
  return generateVoiceReplyFlow(input);
}
