import { NextRequest, NextResponse } from 'next/server';

// ── GLM Translation API via z-ai-web-dev-sdk ──
// Uses GLM LLM for real, high-quality translation

export async function POST(req: NextRequest) {
  try {
    const { text, source, target } = await req.json();

    if (!text || !target) {
      return NextResponse.json({ error: 'Missing text or target language' }, { status: 400 });
    }

    // Use z-ai-web-dev-sdk GLM API for translation
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const sourceLabel = source === 'auto' ? 'the original language' : source;
    const systemPrompt = `You are a professional translator. Translate the given text from ${sourceLabel} to ${target}. Return ONLY the translation, nothing else. Preserve the original formatting, punctuation style, and structure.` ;

    const result = await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      stream: false,
    });

    const translation = result?.choices?.[0]?.message?.content || result?.content || '';

    if (!translation) {
      return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
    }

    // Detect source language if auto
    const detectedLang = source === 'auto' ? detectLang(text) : source;

    return NextResponse.json({
      translation: translation.trim(),
      source: detectedLang,
      target,
    });
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
  return NextResponse.json({ status: 'ok', service: 'VoxPDF Translation API v4 — Powered by GLM' });
}
