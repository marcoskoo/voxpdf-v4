import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Fetches a web page server-side (avoids CORS) and extracts the main article
 * text ready for TTS. Uses a 3-strategy cascade:
 *   1. Direct fetch with browser-like headers
 *   2. r.jina.ai reading proxy (bypasses most bot protection, renders JS)
 *   3. Wayback Machine archived snapshot
 */

function latinRatio(s: string): number {
  const letters = s.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑçÇäëïöüÄËÏÖÜàèìòùÀÈÌÒÙÂÊÎÔÛâêîôû]/g, '');
  const total = s.replace(/\s/g, '').length;
  return total > 0 ? letters.length / total : 0;
}

/**
 * Detects Cloudflare / bot-protection challenge pages that look like real
 * content but are actually security stubs. These pages return HTTP 200 with
 * a short body like "Just a moment..." / "Performing security verification"
 * / "Verifying you are not a bot" / "Checking your browser".
 *
 * Without this check, jina.ai passes the security stub up to the cascade as
 * if it were real article content, blocking the Wayback fallback.
 */
const BOT_WALL_PATTERNS = [
  /just a moment/i,
  /performing security verification/i,
  /verifying you (are|that you are) not (a bot|a robot)/i,
  /checking your browser/i,
  /attention required.{0,30}cloudflare/i,
  /cloudflare.{0,30}(security|ray id|incident id)/i,
  /enable javascript and cookies/i,
  /this page uses javascript/i,
  /please (verify|complete the security check)/i,
  /ddos protection by/i,
];

function looksLikeBotWall(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 2000);
  return BOT_WALL_PATTERNS.some(re => re.test(sample));
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

/** Extracts clean paragraphs from raw HTML */
function extractFromHtml(html: string, fallbackTitle: string): { title: string; paragraphs: string[] } {
  let title = fallbackTitle;
  const tMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (tMatch) title = cleanText(tMatch[1]);

  // Try to find <article> or <main> first for cleaner extraction
  let scope = html;
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (articleMatch && articleMatch[1].length > 500) scope = articleMatch[1];
  else if (mainMatch && mainMatch[1].length > 500) scope = mainMatch[1];
  else {
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

  // Deduplicate repeated blocks (menus, cookie banners)
  const seen = new Set<string>();
  let candidates = blocks.filter(b => {
    const key = b.slice(0, 80).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // If the page has plenty of substantial paragraphs, drop short fragments
  if (candidates.filter(b => b.length >= 200).length >= 5) {
    candidates = candidates.filter(b => b.length >= 60);
  }

  let paragraphs = candidates.filter(b => latinRatio(b) >= 0.6).slice(0, 300);

  // If almost nothing extracted, fall back to full-text strip
  if (paragraphs.length < 2) {
    const stripped = cleanText(scope);
    paragraphs = stripped.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/).filter(s => s.length > 40).slice(0, 200);
  }

  return { title, paragraphs };
}

function packageResult(title: string, url: string, paragraphs: string[], source: string) {
  const words = paragraphs.join(' ').split(/\s+/).length;
  return {
    title: title || url,
    url,
    paragraphs,
    wordCount: words,
    estimatedMinutes: Math.ceil(words / 150),
    source,
  };
}

/** Strategy 1: direct fetch with browser-like headers, fallback to Googlebot UA */
async function tryDirect(url: string): Promise<{ title: string; paragraphs: string[] }> {
  const fetchOptions: RequestInit = {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  };

  let res = await fetch(url, fetchOptions);

  // Retry once with minimal headers if blocked
  if (res.status === 403 || res.status === 429) {
    await new Promise(r => setTimeout(r, 500));
    res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VoxPDFReader/4.0; +https://text2voice3.vercel.app)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
  }

  // Last resort: Googlebot UA. Many sites that block datacenter browsers
  // whitelist Googlebot so their content appears in search results.
  if (res.status === 403 || res.status === 429 || res.status === 503) {
    await new Promise(r => setTimeout(r, 500));
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'From': 'googlebot(at)googlebot.com',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
    const html = await res.text();
    // Reject Cloudflare/bot-protection challenge pages
    if (looksLikeBotWall(html)) throw new Error('bot-wall');
    const { title, paragraphs } = extractFromHtml(html, '');
    if (paragraphs.length < 2) throw new Error('no-text');
    return { title, paragraphs };
  }
  if (contentType.startsWith('text/')) {
    const text = await res.text();
    if (looksLikeBotWall(text)) throw new Error('bot-wall');
    const paragraphs = text.split(/\n\s*\n/).map(s => cleanText(s)).filter(s => s.length > 20).slice(0, 300);
    if (paragraphs.length < 1) throw new Error('no-text');
    return { title: url, paragraphs };
  }
  throw new Error(`tipo ${contentType.split(';')[0]}`);
}

/** Strategy 2: r.jina.ai reading proxy (handles bot protection + JS rendering) */
async function tryJina(url: string, timeoutMs: number): Promise<{ title: string; paragraphs: string[] }> {
  // ⚠️ SIN cabeceras propias: jina rechaza con Cloudflare challenge (403 "Just a moment")
  // si enviamos User-Agent de navegador desde una IP de datacenter. Sin headers → 200.
  const fetchOnce = () => fetch(`https://r.jina.ai/${url}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  let res = await fetchOnce();
  // Jina rate-limits per minute: wait and retry once on transient statuses
  if (!res.ok && [401, 403, 429, 502, 503].includes(res.status)) {
    await new Promise(r => setTimeout(r, 3500));
    res = await fetchOnce();
  }
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  const raw = await res.text();

  // Reject Cloudflare/bot-protection challenge stubs that jina.ai passes
  // through as 200 with "Just a moment..." / "Performing security verification"
  // bodies. Otherwise the cascade treats the stub as real content and never
  // falls through to Wayback.
  if (looksLikeBotWall(raw)) throw new Error('proxy bot-wall');

  // Jina returns: "Title: ...\n\nURL Source: ...\n\nMarkdown Content:\n<body>"
  const titleMatch = raw.match(/^Title:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const contentStart = raw.indexOf('Markdown Content:');
  let content = contentStart >= 0 ? raw.slice(contentStart + 'Markdown Content:'.length) : raw;

  const paragraphs = content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // strip images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')   // links → plain text
    .replace(/^\s*[-*+]\s+/gm, '')             // list bullets
    .split(/\n\s*\n/)
    .map(s => s.replace(/[#>*_`|~]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(s => s.length >= 30 && latinRatio(s) >= 0.5)
    .slice(0, 300);

  if (paragraphs.length < 1) throw new Error('proxy sin texto');
  return { title, paragraphs };
}

/** Strategy 3: Wayback Machine archived snapshot — tries multiple recent snapshots */
async function tryWayback(url: string, timeoutMs: number): Promise<{ title: string; paragraphs: string[] }> {
  // Availability API often slow — give it up to 12s
  const avRes = await fetch(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    { signal: AbortSignal.timeout(Math.min(12000, timeoutMs)) },
  );
  if (!avRes.ok) throw new Error(`archive HTTP ${avRes.status}`);
  const av = await avRes.json();
  const snap = av?.archived_snapshots?.closest?.url;
  if (!snap) throw new Error('sin copia archivada');

  const snapUrl = snap.startsWith('http') ? snap : `https:${snap}`;
  // Snapshot fetch — give it up to 25s for slow archive.org responses
  const res = await fetch(snapUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(Math.min(25000, timeoutMs)),
  });
  if (!res.ok) throw new Error(`archive snapshot HTTP ${res.status}`);
  const html = await res.text();

  // Reject archived Cloudflare challenge pages (snapshot taken during an outage)
  if (looksLikeBotWall(html)) throw new Error('archivo bot-wall');

  const { title, paragraphs } = extractFromHtml(html, '');
  // Filter wayback toolbar noise
  const clean = paragraphs.filter(p => !/wayback machine|archive\.org|internet archive/i.test(p));
  if (clean.length < 1) throw new Error('archivo sin texto');
  return { title, paragraphs: clean };
}

export async function POST(req: NextRequest) {
  try {
    const { url: rawUrl } = await req.json();
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
      return NextResponse.json({ error: 'URL inválida. Debe empezar con http:// o https://' }, { status: 400 });
    }

    // Presupuesto global: Vercel maxDuration 60s → responder antes de 52s
    const t0 = Date.now();
    const budget = () => 52000 - (Date.now() - t0);

    const wordCount = (ps: string[]) => ps.join(' ').split(/\s+/).length;
    const isGood = (ps: string[]) => ps.length >= 3 && wordCount(ps) >= 50;
    type Fetched = { title: string; paragraphs: string[]; source: string };
    const bestRef: { current: Fetched | null } = { current: null };
    const keepBest = (r: Fetched) => {
      if (!bestRef.current || wordCount(r.paragraphs) > wordCount(bestRef.current.paragraphs)) bestRef.current = r;
    };

    const errors: string[] = [];

    // Strategy 1: direct
    if (budget() > 8000) {
      try {
        const r = await tryDirect(rawUrl);
        if (isGood(r.paragraphs)) return NextResponse.json(packageResult(r.title, rawUrl, r.paragraphs, 'direct'));
        keepBest({ ...r, source: 'direct' });
        errors.push(`directo: poco texto útil (${wordCount(r.paragraphs)} palabras, probablemente muro de cookies)`);
      } catch (e: any) {
        errors.push(`directo: ${e?.message || 'fallo'}`);
      }
    } else errors.push('sin tiempo para intento directo');

    // Strategy 2: jina reader proxy
    if (budget() > 8000) {
      try {
        const r = await tryJina(rawUrl, Math.min(20000, budget()));
        if (isGood(r.paragraphs)) return NextResponse.json(packageResult(r.title, rawUrl, r.paragraphs, 'proxy'));
        keepBest({ ...r, source: 'proxy' });
        errors.push('proxy: poco texto útil');
      } catch (e: any) {
        errors.push(`proxy: ${e?.message || 'fallo'}`);
      }
    } else errors.push('sin tiempo para proxy');

    // Strategy 3: wayback machine
    if (budget() > 8000) {
      try {
        const r = await tryWayback(rawUrl, budget());
        if (isGood(r.paragraphs)) return NextResponse.json(packageResult(r.title, rawUrl, r.paragraphs, 'archivo'));
        keepBest({ ...r, source: 'archivo' });
        errors.push('archivo: poco texto útil');
      } catch (e: any) {
        errors.push(`archivo: ${e?.message || 'fallo'}`);
      }
    } else errors.push('sin tiempo para archivo');

    // Ninguna estrategia obtuvo contenido sólido: devolver el mejor esfuerzo si existe
    const best = bestRef.current;
    if (best && best.paragraphs.length && wordCount(best.paragraphs) >= 15) {
      return NextResponse.json(packageResult(best.title, rawUrl, best.paragraphs, best.source));
    }

    return NextResponse.json({
      error: 'No se pudo extraer texto útil de esta página. El sitio puede estar bloqueando el acceso, requerir JavaScript, o tener pago/muro de cookies. Prueba con: (1) copiar y pegar el texto manualmente, (2) subir el PDF si lo tienes, o (3) intentar con otra URL.',
      detail: errors.join(' | '),
    }, { status: 502 });
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
