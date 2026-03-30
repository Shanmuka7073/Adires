import { NextRequest, NextResponse } from 'next/server';
import { generateVoiceReply } from '@/ai/flows/generate-voice-reply-flow';

export async function POST(req: NextRequest) {
  try {
    const { text, language } = await req.json();

    if (!text || !language) {
      return NextResponse.json({ error: 'Text and language are required' }, { status: 400 });
    }

    const result = await generateVoiceReply({ text, language });

    if (result.audioDataUri) {
      return NextResponse.json({ audioDataUri: result.audioDataUri });
    } else {
      return NextResponse.json({ error: 'Failed to generate audio' }, { status: 500 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
