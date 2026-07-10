import { NextRequest, NextResponse } from 'next/server';
import { glmTranslate } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { text, source, target } = await req.json();
    if (!text || !target) {
      return NextResponse.json({ error: 'Missing text or target language' }, { status: 400 });
    }

    const translation = await glmTranslate(text, source || 'auto', target);
    if (!translation) {
      return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
    }

    const detectedLang = source === 'auto' ? detectLang(text) : source;
    return NextResponse.json({ translation, source: detectedLang, target });
  } catch (error: any) {
    console.error('GLM Translation error:', error);
    return NextResponse.json({ error: error.message || 'Translation failed' }, { status: 500 });
  }
}

function detectLang(text: string): string {
  const sample = text.slice(0, 200);
  if (/[àáâãäåèéêëìíîïòóôõöùúûüýÿñç]/i.test(sample)) return 'es';
  if (/[äöüß]/i.test(sample)) return 'de';
  if (/[àâçéèêëîïôùûü]/i.test(sample)) return 'fr';
  return 'en';
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'VoxPDF Translation API — Powered by GLM' });
}
