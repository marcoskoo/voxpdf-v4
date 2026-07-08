import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, source, target } = await req.json();
    
    if (!text || !target) {
      return NextResponse.json({ error: 'Missing text or target language' }, { status: 400 });
    }

    // Simple dictionary-based translation for demo
    // In production, this would use z-ai-web-dev-sdk LLM
    const translations: Record<string, Record<string, string>> = {
      'es-en': {
        'capítulo': 'chapter',
        'página': 'page',
        'libro': 'book',
        'lectura': 'reading',
        'documento': 'document',
        'introducción': 'introduction',
        'conclusión': 'conclusion',
        'resumen': 'summary',
        'importante': 'important',
        'análisis': 'analysis',
        'desarrollo': 'development',
        'tecnología': 'technology',
        'sistema': 'system',
        'método': 'method',
        'resultado': 'result',
        'problema': 'problem',
        'solución': 'solution',
        'investigación': 'research',
        'datos': 'data',
        'información': 'information',
      },
      'en-es': {
        'chapter': 'capítulo',
        'page': 'página',
        'book': 'libro',
        'reading': 'lectura',
        'document': 'documento',
        'introduction': 'introducción',
        'conclusion': 'conclusión',
        'summary': 'resumen',
        'important': 'importante',
        'analysis': 'análisis',
        'development': 'desarrollo',
        'technology': 'tecnología',
        'system': 'sistema',
        'method': 'método',
        'result': 'resultado',
        'problem': 'problema',
        'solution': 'solución',
        'research': 'investigación',
        'data': 'datos',
        'información': 'information',
      },
    };

    // Simple word-by-word translation with dictionary lookup
    const key = `${source === 'auto' ? 'en' : source}-${target}`;
    const dict = translations[key] || {};
    
    const words = text.split(/\s+/);
    const translated = words.map(word => {
      const clean = word.toLowerCase().replace(/[.,!?;:]/g, '');
      const translation = dict[clean];
      if (translation) {
        const punct = word.match(/[.,!?;:]+$/)?.[0] || '';
        const isUpper = word[0] === word[0].toUpperCase();
        const result = isUpper ? translation.charAt(0).toUpperCase() + translation.slice(1) : translation;
        return result + punct;
      }
      return word;
    }).join(' ');

    return NextResponse.json({ 
      translation: translated,
      source: source === 'auto' ? detectLang(text) : source,
      target,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  return NextResponse.json({ status: 'ok', service: 'VoxPDF Translation API v4' });
}
