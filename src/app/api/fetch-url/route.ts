import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

/**
 * Fetches a web page server-side (avoids CORS), extracts the main article
 * text (no JS needed) and returns clean paragraphs ready for TTS.
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'URL inválida. Debe empezar con http:// o https://' }, { status: 400 });
    }

    // Fetch the page with full browser-like headers to avoid bot blocks
    const fetchOptions: RequestInit = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    };

    let res = await fetch(url, fetchOptions);

    // Retry once with minimal headers if blocked (some sites dislike extra headers)
    if (res.status === 403 || res.status === 429) {
      await new Promise(r => setTimeout(r, 600));
      res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VoxPDFReader/4.0; +https://voxpdf.app)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
    }

    if (!res.ok) {
      return NextResponse.json({ error: `El sitio respondió ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || '';
    let title = '';
    let paragraphs: string[] = [];

    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      const html = await res.text();

      // Title
      const tMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (tMatch) title = cleanText(tMatch[1]);

      // Try to find <article> or <main> first for cleaner extraction
      let scope = html;
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      if (articleMatch && articleMatch[1].length > 500) scope = articleMatch[1];
      else if (mainMatch && mainMatch[1].length > 500) scope = mainMatch[1];
      else {
        // Fallback: strip script/style/nav/footer/header/aside from whole page
        scope = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[\s\S]*?<\/nav>/gi, '')
          .replace(/<footer[\s\S]*?<\/footer>/gi, '')
          .replace(/<header[\s\S]*?<\/header>/gi, '')
          .replace(/<aside[\s\S]*?<\/aside>/gi, '')
          .replace(/<form[\s\S]*?<\/form>/gi, '')
          .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
      }

      // Extract block-level text: p, h1-h6, li, blockquote
      const blocks: string[] = [];
      const blockRe = /<(p|h[1-6]|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
      let m;
      while ((m = blockRe.exec(scope)) !== null) {
        const text = cleanText(m[2]);
        if (text.length >= 30) blocks.push(text);
      }

      // Heuristic 1: drop blocks that are mostly non-Latin characters
      // (language menus, unicode noise on multilingual sites like Wikipedia)
      const latinRatio = (s: string): number => {
        const letters = s.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑçÇäëïöüÄËÏÖÜàèìòùÀÈÌÒÙÂÊÎÔÛâêîôû]/g, '');
        return s.replace(/\s/g, '').length > 0 ? letters.length / s.replace(/\s/g, '').length : 0;
      };

      // Deduplicate repeated blocks (menus, cookie banners)
      const seen = new Set<string>();
      let candidates = blocks.filter(b => {
        const key = b.slice(0, 80).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Heuristic 2: if the page has plenty of substantial paragraphs,
      // drop short fragments (menus, breadcrumbs, link lists)
      if (candidates.filter(b => b.length >= 200).length >= 5) {
        candidates = candidates.filter(b => b.length >= 60);
      }

      paragraphs = candidates.filter(b => latinRatio(b) >= 0.6).slice(0, 300);

      // If almost nothing extracted, fall back to full-text strip
      if (paragraphs.length < 2) {
        const stripped = cleanText(scope);
        paragraphs = stripped.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/).filter(s => s.length > 40).slice(0, 200);
      }
    } else if (contentType.startsWith('text/')) {
      const text = await res.text();
      paragraphs = text.split(/\n\s*\n/).map(s => cleanText(s)).filter(s => s.length > 20).slice(0, 300);
    } else {
      return NextResponse.json({ error: `Tipo de contenido no legible: ${contentType}` }, { status: 415 });
    }

    if (!paragraphs.length) {
      return NextResponse.json({ error: 'No se pudo extraer texto de la página (posiblemente requiere JavaScript)' }, { status: 422 });
    }

    return NextResponse.json({
      title: title || url,
      url,
      paragraphs,
      wordCount: paragraphs.join(' ').split(/\s+/).length,
      estimatedMinutes: Math.ceil(paragraphs.join(' ').split(/\s+/).length / 150),
    });
  } catch (error: any) {
    console.error('Fetch URL error:', error);
    const causeCode = error?.cause?.code || error?.code || '';
    const msg = error?.name === 'TimeoutError' || causeCode === 'UND_ERR_CONNECT_TIMEOUT' ? 'La página tardó demasiado en responder'
      : causeCode === 'ENOTFOUND' || causeCode === 'EAI_AGAIN' ? 'No se encontró el dominio. Revisa la URL'
      : causeCode === 'ECONNREFUSED' ? 'El servidor rechazó la conexión'
      : causeCode === 'CERT_HAS_EXPIRED' || causeCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ? 'Certificado SSL inválido en el sitio'
      : error?.message === 'fetch failed' ? 'No se pudo conectar al sitio. Revisa la URL'
      : error?.message || 'Error al acceder a la URL';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function cleanText(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
