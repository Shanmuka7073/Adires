
'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import wav from 'wav';

const GenerateVoiceReplyInputSchema = z.object({
    text: z.string().describe('The text to be converted to speech.'),
    language: z.enum(['en', 'te', 'hi']).describe('The language of the text.'),
});
export type GenerateVoiceReplyInput = z.infer<typeof GenerateVoiceReplyInputSchema>;

const GenerateVoiceReplyOutputSchema = z.object({
    audioDataUri: z.string().describe("A data URI of the generated audio in WAV format. E.g., 'data:audio/wav;base64,...'"),
});
export type GenerateVoiceReplyOutput = z.infer<typeof GenerateVoiceReplyOutputSchema>;

// Helper to convert PCM buffer to WAV base64 string
async function toWav(pcmData: Buffer, channels = 1, rate = 24000, sampleWidth = 2): Promise<string> {
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

// Main exported function
export async function generateVoiceReply(input: GenerateVoiceReplyInput): Promise<GenerateVoiceReplyOutput> {
    return generateVoiceReplyFlow(input);
}

const generateVoiceReplyFlow = ai.defineFlow(
    {
        name: 'generateVoiceReplyFlow',
        inputSchema: GenerateVoiceReplyInputSchema,
        outputSchema: GenerateVoiceReplyOutputSchema,
    },
    async ({ text, language }) => {
        
        let voiceName: string;
        switch (language) {
            case 'te':
                voiceName = 'Vayu'; // Example Telugu voice
                break;
            case 'hi':
                voiceName = 'Aarav'; // Example Hindi voice
                break;
            default:
                voiceName = 'Algenib'; // Example English (India) voice
                break;
        }

        const { media } = await ai.generate({
            model: googleAI.model('gemini-2.5-flash-preview-tts'),
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
            prompt: text,
        });

        if (!media || !media.url) {
            throw new Error('AI service did not return any audio media.');
        }

        const audioBuffer = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
        const wavBase64 = await toWav(audioBuffer);

        return {
            audioDataUri: 'data:audio/wav;base64,' + wavBase64,
        };
    }
);
