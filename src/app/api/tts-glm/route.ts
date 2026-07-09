import { NextRequest, NextResponse } from 'next/server';

// ── GLM TTS API — Text-to-speech using GLM audio API ──

export async function POST(req: NextRequest) {
  try {
    const { text, voice, speed } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const result = await zai.audio.tts.create({
      model: 'tts-1',
      input: text.slice(0, 4000),
      voice: voice || 'alloy',
      speed: speed || 1.0,
      response_format: 'mp3',
    });

    // The result may be a buffer or URL depending on SDK version
    if (result instanceof Buffer || result instanceof ArrayBuffer || (result as any)?.data) {
      const audioBuffer = (result as any)?.data || result;
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBuffer.byteLength || audioBuffer.length),
        },
      });
    }

    // If result is a URL or base64 string
    if (typeof result === 'string') {
      if (result.startsWith('data:')) {
        const base64 = result.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');
        return new NextResponse(buffer, {
          headers: { 'Content-Type': 'audio/mpeg' },
        });
      }
      return NextResponse.json({ url: result });
    }

    // Fallback: return whatever we got
    return NextResponse.json({ result: String(result) });
  } catch (error: any) {
    console.error('GLM TTS error:', error);
    // Fallback: indicate browser TTS should be used instead
    return NextResponse.json({
      error: error.message || 'TTS generation failed',
      fallback: 'browser-tts',
    }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'VoxPDF TTS API — Powered by GLM' });
}
