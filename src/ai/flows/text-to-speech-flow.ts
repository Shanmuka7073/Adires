/**
 * @fileOverview A flow to convert text to speech using Google's TTS model.
 */
'use server';

import { ai } from '@/ai/genkit';
import { 
    TextToSpeechInputSchema, 
    TextToSpeechOutputSchema,
    type TextToSpeechInput,
    type TextToSpeechOutput
} from './schemas';
import wav from 'wav';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Converts raw PCM audio data into a Base64-encoded WAV string.
 */
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
    writer.on('data', (d) => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));

    writer.write(pcmData);
    writer.end();
  });
}


export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
    return textToSpeechFlow(input);
}


// This is the Genkit flow, which is not exported directly to the client.
const textToSpeechFlow = ai.defineFlow(
  {
    name: 'textToSpeechFlow',
    inputSchema: TextToSpeechInputSchema,
    outputSchema: TextToSpeechOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { 
                // Choose a voice. 'Algenib' is a good Indian English option.
                // Other options include 'Achernar', 'Sirius', etc.
                voiceName: input.language.startsWith('te') ? 'te-IN-Standard-A' : 'Algenib' 
            },
          },
        },
      },
      prompt: input.text,
    });

    if (!media) {
      throw new Error('No audio media was returned from the TTS model.');
    }
    
    // The returned URL is a data URI with base64 encoded PCM data
    const pcmDataBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );
    
    // Convert the raw PCM data to a WAV format and encode it as base64
    const wavBase64 = await toWav(pcmDataBuffer);

    return {
      audioDataUri: 'data:audio/wav;base64,' + wavBase64,
    };
  }
);
