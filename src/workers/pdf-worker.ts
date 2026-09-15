/**
 * VoxPDF v4 — PDF Web Worker
 * Parses PDF in a separate thread to avoid blocking the UI
 */
declare function importScripts(...urls: string[]): void;

interface PDFWorkerMessage {
  type: 'parse';
  data: ArrayBuffer;
}

interface PDFPageData {
  paragraphs: Array<{
    text: string;
    page: number;
    isHeader: boolean;
    isFooter: boolean;
  }>;
  totalPages: number;
}

// We'll use pdfjs-dist in the worker context
// The worker loads pdfjs from CDN since we can't bundle it easily
let pdfjsLib: any = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  // Dynamic import for worker context
  try {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';  // We ARE the worker
  } catch {
    // Fallback: Can't use CDN in worker easily, use importScripts
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib = (self as any).pdfjsLib;
  }
  return pdfjsLib;
}

async function parsePDF(data: ArrayBuffer): Promise<PDFPageData> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data }).promise;
  const totalPages = doc.numPages;
  const paragraphs: PDFPageData['paragraphs'] = [];

  for (let pg = 1; pg <= totalPages; pg++) {
    const page = await doc.getPage(pg);
    const content = await page.getTextContent();
    const vp = page.getViewport({ scale: 1 });
    const pH = vp.height;
    const HZ = pH * 0.08;
    const FZ = pH * 0.08;

    const items = content.items.slice().sort((a: any, b: any) => b.transform[5] - a.transform[5]);
    const lines: any[] = [];
    let cur: any[] = [];
    let cy: number | null = null;

    for (const it of items) {
      const y = it.transform[5];
      if (cy === null || Math.abs(y - cy) < 3) { cur.push(it); cy = y; }
      else { if (cur.length) lines.push({ y: cy, items: cur }); cur = [it]; cy = y; }
    }
    if (cur.length) lines.push({ y: cy, items: cur });

    let buf: string[] = [];
    let lastT: string | null = null;
    const flush = (isH: boolean, isF: boolean) => {
      const txt = buf.join(' ').replace(/\s+/g, ' ').trim();
      buf = [];
      if (!txt) return;
      paragraphs.push({ text: txt, page: pg, isHeader: isH, isFooter: isF });
    };

    for (const l of lines) {
      const txt = l.items.map((i: any) => i.str).join(' ').trim();
      if (!txt) continue;
      const relY = pH - l.y;
      const t = relY < HZ ? 'h' : relY > (pH - FZ) ? 'f' : 'b';
      if (lastT && t !== lastT) flush(lastT === 'h', lastT === 'f');
      buf.push(txt);
      lastT = t;
    }
    if (buf.length) flush(lastT === 'h', lastT === 'f');

    // Report progress
    (self as any).postMessage({ type: 'progress', page: pg, total: totalPages });
  }

  return { paragraphs, totalPages };
}

(self as any).onmessage = async (e: MessageEvent<PDFWorkerMessage>) => {
  if (e.data.type === 'parse') {
    try {
      const result = await parsePDF(e.data.data);
      (self as any).postMessage({ type: 'done', data: result });
    } catch (error: any) {
      (self as any).postMessage({ type: 'error', error: error.message });
    }
  }
};
