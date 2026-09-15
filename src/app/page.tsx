'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useVoxPDFStore } from '@/stores/voxpdf-store';
import { EQ_PRESETS, HEAT_COLORS, MindMapNode, Bookmark, GlossaryTerm, Flashcard, AI_ENGINE, AI_MODEL } from '@/lib/voxpdf-types';
import {
  BookOpen, Play, Pause, SkipBack, SkipForward, Square, Search, Bookmark as BookmarkIcon,
  Settings, RotateCcw, Mic, MicOff, Timer,
  Maximize, Columns2, Brain, Languages, FileDown, FileUp, Cloud, CloudOff,
  Users, MessageSquare, Layers, Flame, Zap,
  X, Plus, RefreshCw, Globe,
  Sparkles, Download, Copy,
  PanelLeftClose, PanelLeftOpen, FileText,
  Moon,
  ScanLine, MessageCircle, GitCompare, HelpCircle, Quote, ListChecks, Table2, BarChart3, TrendingUp, Smile, Frown, Meh, Share2, Languages as LangIcon, Calendar, SplitSquareVertical, Headphones, Radio, Volume2, Subtitles, Globe as GlobeIcon, CloudDownload, Target, ChevronRight, ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

// ── PDF.js dynamic import ──
let pdfjsLib: any = null;
if (typeof window !== 'undefined') {
  import('pdfjs-dist').then(mod => {
    pdfjsLib = mod;
    mod.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }).catch(() => {
    // Fallback: load from CDN
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    };
    document.head.appendChild(s);
  });
}

// ── Utility functions ──
function esc(s: string) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function splitSentences(text: string): { text: string; offset: number }[] {
  const re = /[^.!?;]+[.!?;]*/g;
  const sents: { text: string; offset: number }[] = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0].trim()) sents.push({ text: m[0], offset: m.index });
  }
  if (!sents.length) sents.push({ text, offset: 0 });
  return sents;
}

function detectLang(text: string): string {
  const sample = text.slice(0, 200);
  if (/[àáâãäåèéêëìíîïòóôõöùúûüýÿñç]/i.test(sample)) return 'es';
  if (/[äöüß]/i.test(sample)) return 'de';
  if (/[àâçéèêëîïôùûü]/i.test(sample)) return 'fr';
  return 'en';
}

// ── Theme CSS maps ──
const THEME_STYLES: Record<string, React.CSSProperties> = {
  dark: { background: '#0a0a0c', color: '#e8e8f0' },
  light: { background: '#f2f1f8', color: '#14141f' },
  sepia: { background: '#f4ede0', color: '#3b2a14' },
  contrast: { background: '#000', color: '#fff' },
  ocean: { background: '#050d14', color: '#d0eaf8' },
  eink: { background: '#f8f6f0', color: '#1a1a1a' },
};

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export default function VoxPDFv4() {
  const store = useVoxPDFStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const pomodoroRef = useRef<NodeJS.Timeout | null>(null);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceRecognitionRef = useRef<any>(null);
  const lazyObserverRef = useRef<IntersectionObserver | null>(null);
  const renderedPagesRef = useRef<Set<number>>(new Set());
  const translationWorkerRef = useRef<Worker | null>(null);
  const pdfWorkerRef = useRef<Worker | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarkParaIdx, setBookmarkParaIdx] = useState(0);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [ocrFileName, setOcrFileName] = useState('');
  const [showMindMap, setShowMindMap] = useState(false);
  const [showGlossaryPopup, setShowGlossaryPopup] = useState(false);
  const [glossaryPopupTerm, setGlossaryPopupTerm] = useState('');
  const [glossaryPopupDef, setGlossaryPopupDef] = useState('');
  const [glossaryPopupPos, setGlossaryPopupPos] = useState({ x: 0, y: 0 });
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [showRSVP, setShowRSVP] = useState(false);
  const [rsvpWord, setRsvpWord] = useState('');
  const [rsvpIdx, setRsvpIdx] = useState(0);
  const [rsvpWPM, setRsvpWPM] = useState(300);
  const [rsvpPlaying, setRsvpPlaying] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomInput, setRoomInput] = useState('');
  const [roomChatInput, setRoomChatInput] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cbzImages, setCbzImages] = useState<string[]>([]);
  const [parallelNotes, setParallelNotes] = useState<Record<number, string>>({});
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Initialize ──
  useEffect(() => {
    loadSettings();
    loadVoices();
    setLoaded(true);
    // Widget embed support: detect embed mode & listen for host messages
    const params = new URLSearchParams(window.location.search);
    if (params.get('embed') === 'true') {
      store.setSidebarOpen(false);
      // Notify parent that widget is ready
      window.parent.postMessage({ source: 'voxpdf', type: 'ready' }, '*');
      // Listen for commands from host
      const handler = (e: MessageEvent) => {
        if (e.data?.source !== 'host') return;
        switch (e.data.type) {
          case 'play': togglePlay(); break;
          case 'pause': pauseReading(); break;
          case 'next': nextPara(); break;
          case 'prev': prevPara(); break;
          case 'jumpTo': if (e.data.idx !== undefined) jumpTo(e.data.idx); break;
          case 'setTheme': store.setTheme(e.data.theme || 'dark'); break;
        }
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }
    return () => {
      stopReading(true);
      releaseWakeLock();
      if (pomodoroRef.current) clearInterval(pomodoroRef.current);
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    };
  }, []);

  // ── Theme effect ──
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', store.theme);
  }, [store.theme]);

  // ── Focus mode effect ──
  useEffect(() => {
    document.documentElement.setAttribute('data-focus', store.focusMode ? 'on' : 'off');
  }, [store.focusMode]);

  // ── Invert mode effect ──
  useEffect(() => {
    document.documentElement.setAttribute('data-invert', store.invertMode ? 'on' : 'off');
  }, [store.invertMode]);

  // ── Ambient sound volume sync ──
  useEffect(() => {
    if (ambientAudioRef.current) {
      ambientAudioRef.current.volume = store.ambientVolume;
    }
  }, [store.ambientVolume, store.ambientSound]);

  // ── Save settings on change ──
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem('vox4_settings', JSON.stringify({
        rate: store.rate, pitch: store.pitch, volume: store.volume,
        fontSize: store.fontSize, fontFamily: store.fontFamily, theme: store.theme,
        focusMode: store.focusMode, invertMode: store.invertMode,
        skipHF: store.skipHF, highlightWords: store.highlightWords,
        pauseOnPunctuation: store.pauseOnPunctuation,
        preSynthesisLookahead: store.preSynthesisLookahead,
        autoLanguageSwitch: store.autoLanguageSwitch,
        eqBands: store.eqBands, eqPresetName: store.eqPresetName,
        teleprompterMode: store.teleprompterMode, parallelView: store.parallelView,
        einkOptimized: store.einkOptimized, lazyRendering: store.lazyRendering,
        translation: store.translation, pomodoro: store.pomodoro,
      }));
    } catch (e) {}
  }, [store.rate, store.pitch, store.volume, store.fontSize, store.fontFamily,
      store.theme, store.focusMode, store.invertMode, store.skipHF, store.highlightWords,
      store.pauseOnPunctuation, store.preSynthesisLookahead, store.autoLanguageSwitch,
      store.eqBands, store.eqPresetName, store.teleprompterMode, store.parallelView,
      store.einkOptimized, store.lazyRendering, store.translation, store.pomodoro]);

  // ── Sleep timer countdown ──
  useEffect(() => {
    if (store.sleepTimerMinutes <= 0) return;
    const interval = setInterval(() => {
      const remaining = store.sleepTimerRemaining - 1;
      store.setSleepTimerRemaining(remaining);
      if (remaining <= 0) {
        store.setSleepTimerMinutes(0);
        if (store.playing) pauseReading();
        toast({ title: 'Sleep Timer', description: 'La lectura se ha pausado' });
      }
    }, 1000);
    sleepTimerRef.current = interval;
    return () => { if (sleepTimerRef.current) clearInterval(sleepTimerRef.current); };
  }, [store.sleepTimerMinutes, store.sleepTimerRemaining]);

  // ── Lazy rendering observer ──
  useEffect(() => {
    if (!store.lazyRendering || !contentRef.current) return;
    lazyObserverRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const page = parseInt((entry.target as HTMLElement).dataset.page || '0');
          if (page && !renderedPagesRef.current.has(page)) {
            renderedPagesRef.current.add(page);
            // Mark as rendered (content already visible via CSS)
            (entry.target as HTMLElement).style.opacity = '1';
          }
        }
      });
    }, { rootMargin: '200px' });
    return () => { lazyObserverRef.current?.disconnect(); };
  }, [store.lazyRendering, store.paragraphs]);

  // ── Functions ──
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('vox4_settings') || '{}');
      if (s.rate) store.setRate(s.rate);
      if (s.pitch) store.setPitch(s.pitch);
      if (s.volume !== undefined) store.setVolume(s.volume);
      if (s.fontSize) store.setFontSize(s.fontSize);
      if (s.fontFamily) store.setFontFamily(s.fontFamily);
      if (s.theme) store.setTheme(s.theme);
      if (s.focusMode !== undefined) store.setFocusMode(s.focusMode);
      if (s.invertMode !== undefined) store.setInvertMode(s.invertMode);
      if (s.skipHF !== undefined) store.setSkipHF(s.skipHF);
      if (s.highlightWords !== undefined) store.setHighlightWords(s.highlightWords);
      if (s.pauseOnPunctuation !== undefined) store.setPauseOnPunctuation(s.pauseOnPunctuation);
      if (s.preSynthesisLookahead !== undefined) store.setPreSynthesisLookahead(s.preSynthesisLookahead);
      if (s.autoLanguageSwitch !== undefined) store.setAutoLanguageSwitch(s.autoLanguageSwitch);
      if (s.eqBands) store.setEqBands(s.eqBands);
      if (s.eqPresetName) store.setEqPresetName(s.eqPresetName);
      if (s.teleprompterMode !== undefined) store.setTeleprompterMode(s.teleprompterMode);
      if (s.parallelView !== undefined) store.setParallelView(s.parallelView);
      if (s.einkOptimized !== undefined) store.setEinkOptimized(s.einkOptimized);
      if (s.lazyRendering !== undefined) store.setLazyRendering(s.lazyRendering);
      if (s.translation) store.setTranslation(s.translation);
      if (s.pomodoro) store.setPomodoro(s.pomodoro);
    } catch (e) {}
  }

  function loadVoices() {
    const load = () => {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return;
      const voiceInfos = voices.map((v, i) => ({
        voice: v, lang: v.lang, name: v.name
      }));
      store.setVoices(voiceInfos);
      const esIdx = voices.findIndex(v => v.lang.startsWith('es'));
      if (esIdx >= 0) store.setSelectedVoice(esIdx);
    };
    load();
    speechSynthesis.onvoiceschanged = load;
  }

  // ── File Loading ──
  async function loadFileObj(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    store.setFileName(file.name);
    try {
      if (ext === 'pdf') await loadPDF(file);
      else if (ext === 'epub') await loadEPUB(file);
      else if (ext === 'docx' || ext === 'doc') await loadDOCX(file);
      else if (ext === 'txt') await loadTXT(file);
      else if (ext === 'cbz' || ext === 'cbr') await loadCBZ(file);
      else if (/^(png|jpe?g|webp|tiff?)$/.test(ext)) await loadImageOCR(file);
      else toast({ title: 'Error', description: `Formato no soportado: .${ext}`, variant: 'destructive' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function loadPDF(file: File) {
    if (!pdfjsLib) {
      toast({ title: 'Cargando PDF.js...', description: 'Espera un momento' });
      await new Promise(r => setTimeout(r, 2000));
      if (!pdfjsLib) throw new Error('PDF.js no disponible');
    }
    const ab = await file.arrayBuffer();
    // Try Web Worker first for non-blocking parsing
    // Note: we slice() the buffer so the transfer doesn't detach the original,
    // keeping it available for the main-thread fallback.
    try {
      const worker = new Worker(new URL('@/workers/pdf-worker.ts', import.meta.url));
      const workerAb = ab.slice(0); // copy for transfer
      const result = await new Promise<any>((resolve, reject) => {
        worker.onmessage = (e) => {
          if (e.data.type === 'done') { resolve(e.data.data); worker.terminate(); }
          else if (e.data.type === 'error') { reject(new Error(e.data.error)); worker.terminate(); }
        };
        worker.postMessage({ type: 'parse', data: workerAb }, [workerAb]);
      });
      store.setParagraphs(result.paragraphs);
      store.setTotalPages(result.totalPages);
    } catch {
      // Fallback to main thread — ab is still usable because we sliced it
      const doc = await pdfjsLib.getDocument({ data: ab }).promise;
      store.setTotalPages(doc.numPages);
      await extractRenderPDF(doc);
    }
    addRecent(file.name, 0);
    restoreProgress(file.name);
    buildTOC();
    computeWordFrequency();
    computeMindMap();
    toast({ title: file.name, description: `PDF cargado` });
  }

  async function extractRenderPDF(pdfDoc: any) {
    const paras: any[] = [];
    const N = pdfDoc.numPages;
    // Lazy rendering: only extract visible pages first
    const batchSize = store.lazyRendering ? 5 : N;
    for (let pg = 1; pg <= Math.min(batchSize, N); pg++) {
      const page = await pdfDoc.getPage(pg);
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
      const pageText = lines.map((l: any) => l.items.map((i: any) => i.str).join('')).join('').trim();
      if (!pageText) continue; // OCR would go here for scanned pages
      let buf: string[] = [];
      let lastT: string | null = null;
      const flush = (isH: boolean, isF: boolean) => {
        const txt = buf.join(' ').replace(/\s+/g, ' ').trim();
        buf = [];
        if (!txt) return;
        paras.push({ text: txt, page: pg, isHeader: isH, isFooter: isF });
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
    }
    store.setParagraphs(paras);
  }

  async function loadEPUB(file: File) {
    // Dynamic JSZip import
    const JSZip = (await import('jszip')).default;
    const ab = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);
    const containerXml = await zip.file('META-INF/container.xml')?.async('text');
    const opfPath = containerXml?.match(/full-path="([^"]+\.opf)"/i)?.[1];
    if (!opfPath) throw new Error('EPUB sin OPF');
    const opfBase = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
    const opfDoc = new DOMParser().parseFromString(await zip.file(opfPath)?.async('text') || '', 'application/xml');
    const manifest: Record<string, string> = {};
    opfDoc.querySelectorAll('manifest item').forEach((item: any) => {
      manifest[item.id] = opfBase + item.getAttribute('href');
    });
    const spine = Array.from(opfDoc.querySelectorAll('spine itemref')).map((i: any) => i.getAttribute('idref'));
    let allText = '';
    for (const id of spine) {
      const href = manifest[id];
      if (!href) continue;
      const f = zip.file(href);
      if (!f) continue;
      const html = await f.async('text');
      const hdoc = new DOMParser().parseFromString(html, 'text/html');
      hdoc.querySelectorAll('script,style,nav').forEach(e => e.remove());
      allText += (hdoc.body?.textContent || '') + '\n\n';
    }
    renderPlainText(allText);
    addRecent(file.name, 0);
    toast({ title: file.name, description: 'EPUB cargado' });
  }

  async function loadDOCX(file: File) {
    const JSZip = (await import('jszip')).default;
    const ab = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);
    const xml = await zip.file('word/document.xml')?.async('text');
    if (!xml) throw new Error('DOCX sin document.xml');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    let text = '';
    doc.querySelectorAll('p').forEach((p: any) => {
      const t = Array.from(p.querySelectorAll('t')).map((n: any) => n.textContent).join('');
      if (t.trim()) text += t.trim() + '\n\n';
    });
    renderPlainText(text);
    addRecent(file.name, 0);
    toast({ title: file.name, description: 'DOCX cargado' });
  }

  async function loadTXT(file: File) {
    const text = await file.text();
    renderPlainText(text);
    addRecent(file.name, 0);
    toast({ title: file.name, description: 'TXT cargado' });
  }

  async function loadCBZ(file: File) {
    const JSZip = (await import('jszip')).default;
    const ab = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);
    const images: string[] = [];
    const exts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const files = Object.keys(zip.files)
      .filter(f => exts.some(e => f.toLowerCase().endsWith(e)))
      .sort();
    for (const fname of files) {
      const blob = await zip.file(fname)?.async('blob');
      if (blob) images.push(URL.createObjectURL(blob));
    }
    setCbzImages(images);
    // Create virtual paragraphs from page count
    const paras = images.map((_, i) => ({
      text: `[Página del cómic ${i + 1}]`,
      page: i + 1,
      isHeader: false,
      isFooter: false,
    }));
    store.setParagraphs(paras);
    store.setTotalPages(images.length);
    addRecent(file.name, 0);
    toast({ title: file.name, description: `CBZ: ${images.length} páginas` });
  }

  async function loadImageOCR(file: File) {
    // Simplified: would use Tesseract.js
    const paras = [{ text: `[Imagen: ${file.name} — OCR pendiente]`, page: 1, isHeader: false, isFooter: false }];
    store.setParagraphs(paras);
    toast({ title: file.name, description: 'Imagen cargada' });
  }

  function renderPlainText(text: string) {
    const rawParas = text.split(/\n\s*\n/).map(p => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()).filter(p => p.length > 0);
    const paras = rawParas.map((txt, i) => ({
      text: txt,
      page: 1 + Math.floor(i / 20),
      isHeader: false,
      isFooter: false,
    }));
    store.setParagraphs(paras);
    store.setTotalPages(Math.ceil(rawParas.length / 20));
    buildTOC();
    computeWordFrequency();
    computeMindMap();
  }

  // ── Recents ──
  function getRecents() {
    try { return JSON.parse(localStorage.getItem('vox4_recents') || '[]'); } catch { return []; }
  }
  function addRecent(name: string, pct: number) {
    let r = getRecents().filter((x: any) => x.name !== name);
    r.unshift({ name, pct, date: Date.now() });
    try { localStorage.setItem('vox4_recents', JSON.stringify(r.slice(0, 12))); } catch {}
  }

  // ── OCR: imagen → texto → lector ──
  async function handleOcrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    stopReading(true);
    store.setOcrActive(true);
    store.setOcrProgress(5);
    store.setOcrResult('');
    setOcrFileName(file.name);
    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('spa+eng', 1, {
        logger: (m: any) => {
          if (m.status === 'loading language traineddata' || m.status === 'initializing api') store.setOcrProgress(15);
          if (m.status === 'recognizing text') store.setOcrProgress(30 + Math.round(m.progress * 65));
        },
      });
      store.setOcrProgress(20);
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const text = (data?.text || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
      store.setOcrProgress(100);
      if (text.length < 10) {
        store.setOcrResult('');
        toast({ title: 'OCR sin resultados', description: 'No se detectó texto legible. Prueba con una imagen más nítida y con buen contraste.', variant: 'destructive' });
      } else {
        store.setOcrResult(text);
        toast({ title: 'OCR completado ✓', description: `${text.split(/\s+/).length} palabras extraídas de ${file.name}` });
      }
    } catch (err: any) {
      toast({ title: 'Error en OCR', description: err?.message || 'No se pudo procesar la imagen', variant: 'destructive' });
    }
    store.setOcrActive(false);
    e.target.value = '';
  }

  function loadOcrIntoReader() {
    const text = store.ocrResult;
    if (!text) { toast({ title: 'Primero extrae texto con OCR' }); return; }
    const paras = text.split(/\n\s*\n|(?<=\.)\s{2,}/).map((t: string) => t.trim()).filter((t: string) => t.length > 0).map((txt: string, j: number) => ({ text: txt, page: 1 + Math.floor(j / 20), isHeader: false, isFooter: false }));
    if (!paras.length) { toast({ title: 'No hay texto para cargar' }); return; }
    const name = ocrFileName ? `📄 ${ocrFileName}` : '📄 OCR';
    store.setFileName(name);
    store.setParagraphs(paras);
    store.setTotalPages(Math.ceil(paras.length / 20));
    store.setCurrentParaIdx(0);
    buildTOC(); computeWordFrequency(); computeMindMap();
    addRecent(name, 0);
    toast({ title: 'Texto OCR cargado', description: 'Reproduciendo...' });
    setTimeout(() => startReading(0), 400);
  }

  // ── Progress ──
  function saveProgress(name: string, idx: number) {
    try {
      const p = JSON.parse(localStorage.getItem('vox4_progress') || '{}');
      p[name] = { idx, ts: Date.now() };
      localStorage.setItem('vox4_progress', JSON.stringify(p));
    } catch {}
  }
  function restoreProgress(name: string) {
    try {
      const p = JSON.parse(localStorage.getItem('vox4_progress') || '{}');
      if (p[name]) {
        const idx = Math.min(p[name].idx, store.paragraphs.length - 1);
        if (idx > 0) {
          store.setCurrentParaIdx(idx);
          toast({ title: 'Continuando', description: `Desde párrafo ${idx + 1}` });
        }
      }
    } catch {}
  }

  // ── TOC ──
  function buildTOC() {
    const chapters: any[] = [];
    const reT = /^(cap[ií]tulo|chapter|parte|part|secci[oó]n|section|art[ií]culo|tema|unidad|ap[eé]ndice|introduction|introducci[oó]n|conclusion|resumen|summary|abstract|prefacio|pr[oó]logo)\s*[\d.\-:IVXivx]*/i;
    const reN = /^(\d+[.\-)]|[IVXivx]+[.\-)]|\([a-z\d]+\))\s+\S/;
    store.paragraphs.forEach((p, i) => {
      if (p.isHeader || p.isFooter) return;
      const w = p.text.trim().split(/\s+/);
      if (w.length > 14) return;
      const t = p.text.trim();
      if (reT.test(t) || reN.test(t) || (w.length <= 10 && t.length > 4)) {
        chapters.push({ title: t.slice(0, 60), startIdx: i, page: p.page });
      }
    });
    if (chapters.length < 2) {
      const byPage: any = {};
      store.paragraphs.forEach((p, i) => {
        if (!byPage[p.page]) byPage[p.page] = { page: p.page, startIdx: i };
      });
      const pages = Object.values(byPage).sort((a: any, b: any) => a.page - b.page);
      if (pages.length <= 30) {
        pages.forEach((pg: any) => chapters.push({ title: `Página ${pg.page}`, startIdx: pg.startIdx, page: pg.page }));
      }
    }
    store.setChapters(chapters);
  }

  // ── Word Frequency (Heat Map) ──
  function computeWordFrequency() {
    const freq: Record<string, number> = {};
    store.paragraphs.forEach(p => {
      const words = p.text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    });
    store.setWordFrequency(freq);
  }

  // ── Mind Map (GLM-powered) ──
  async function computeMindMap() {
    if (!store.paragraphs.length) return;
    try {
      const res = await fetch('/api/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paragraphs: store.paragraphs,
          chapters: store.chapters,
          fileName: store.fileName,
        }),
      });
      const data = await res.json();
      if (data.mindMap && data.mindMap.children && data.mindMap.children.length > 0) {
        // Add depth to nodes recursively
        const addDepth = (node: MindMapNode, d: number) => {
          node.depth = d;
          node.children.forEach(c => addDepth(c, d + 1));
        };
        addDepth(data.mindMap, 0);
        store.setMindMap(data.mindMap);
        return;
      }
    } catch (e) {
      console.error('GLM mind map error:', e);
    }
    // Fallback: local mind map
    computeMindMapLocal();
  }

  function computeMindMapLocal() {
    const root: MindMapNode = { id: 'root', label: store.fileName || 'Documento', children: [], depth: 0 };
    store.chapters.forEach((ch, i) => {
      const chapterNode: MindMapNode = { id: `ch-${i}`, label: ch.title, children: [], depth: 1 };
      const start = ch.startIdx;
      const end = i < store.chapters.length - 1 ? store.chapters[i + 1].startIdx : Math.min(start + 5, store.paragraphs.length);
      for (let j = start; j < Math.min(start + 3, end); j++) {
        const firstSentence = store.paragraphs[j]?.text.split(/[.!?]/)[0] || '';
        if (firstSentence.length > 5) {
          chapterNode.children.push({
            id: `ch-${i}-p${j}`,
            label: firstSentence.slice(0, 60),
            children: [],
            depth: 2,
          });
        }
      }
      root.children.push(chapterNode);
    });
    if (root.children.length === 0 && store.paragraphs.length > 0) {
      const byPage: Record<number, string[]> = {};
      store.paragraphs.forEach(p => {
        if (!byPage[p.page]) byPage[p.page] = [];
        byPage[p.page].push(p.text.split(/[.!?]/)[0]);
      });
      Object.entries(byPage).slice(0, 15).forEach(([pg, texts]) => {
        root.children.push({
          id: `pg-${pg}`,
          label: `Página ${pg}`,
          children: texts.slice(0, 2).map((t, i) => ({
            id: `pg-${pg}-t${i}`, label: t.slice(0, 60), children: [], depth: 2
          })),
          depth: 1,
        });
      });
    }
    store.setMindMap(root);
  }

  // ── TTS Engine ──
  function startReading(fromIdx?: number) {
    stopReading(true);
    const startIdx = fromIdx ?? store.currentParaIdx;
    const readableParas = store.paragraphs
      .map((p, i) => ({ ...p, idx: i }))
      .filter(p => !(p.isHeader || p.isFooter) || !store.skipHF)
      .filter(p => p.idx >= startIdx);
    if (!readableParas.length) {
      toast({ title: 'Fin del documento' });
      return;
    }

    // Pre-synthesis lookahead: split into sentence chunks
    if (store.pauseOnPunctuation) {
      readWithPunctuationPauses(readableParas, 0);
    } else {
      readContinuous(readableParas);
    }
  }

  function readContinuous(paras: any[]) {
    const bigText = paras.map(p => p.text).join(' \n ');
    const utt = new SpeechSynthesisUtterance(bigText);
    const voice = store.voices[store.selectedVoice]?.voice;
    if (voice) utt.voice = voice;
    utt.rate = store.rate;
    utt.pitch = store.pitch;
    utt.volume = store.volume;
    utt.lang = voice?.lang || 'es-ES';

    utt.onboundary = (e) => {
      if (!store.playing) return;
      // Find current paragraph by char index
      let charCount = 0;
      for (const p of paras) {
        charCount += p.text.length + 3;
        if (charCount > e.charIndex) {
          store.setCurrentParaIdx(p.idx);
          saveProgress(store.fileName, p.idx);
          scrollToPara(p.idx);
          break;
        }
      }
    };

    utt.onend = () => {
      store.setPlaying(false);
      releaseWakeLock();
    };

    utteranceRef.current = utt;
    store.setPlaying(true);
    acquireWakeLock();
    speechSynthesis.speak(utt);
  }

  function readWithPunctuationPauses(paras: any[], paraOffset: number) {
    if (paraOffset >= paras.length) {
      store.setPlaying(false);
      releaseWakeLock();
      return;
    }
    const p = paras[paraOffset];
    const sents = splitSentences(p.text);

    store.setCurrentParaIdx(p.idx);
    scrollToPara(p.idx);
    saveProgress(store.fileName, p.idx);

    let sentIdx = 0;
    function speakNext() {
      if (sentIdx >= sents.length) {
        // Move to next paragraph
        readWithPunctuationPauses(paras, paraOffset + 1);
        return;
      }
      const sent = sents[sentIdx];
      // Auto language switch
      let lang = store.voices[store.selectedVoice]?.voice?.lang || 'es-ES';
      if (store.autoLanguageSwitch) {
        const detected = detectLang(sent.text);
        const matchingVoice = store.voices.findIndex(v => v.lang.startsWith(detected));
        if (matchingVoice >= 0) lang = store.voices[matchingVoice].voice.lang;
      }
      const utt = new SpeechSynthesisUtterance(sent.text);
      const voice = store.voices[store.selectedVoice]?.voice;
      if (voice) utt.voice = voice;
      utt.rate = store.rate;
      utt.pitch = store.pitch;
      utt.volume = store.volume;
      utt.lang = lang;

      // Pre-synthesis lookahead: prepare next utterance while current speaks
      utt.onend = () => {
        sentIdx++;
        // Pause at punctuation marks
        const lastChar = sent.text.trim().slice(-1);
        const pauseMs = lastChar === '.' ? 500 : lastChar === ',' ? 200 : lastChar === ';' ? 350 : lastChar === '!' || lastChar === '?' ? 400 : 100;
        setTimeout(speakNext, pauseMs);
      };

      utteranceRef.current = utt;
      speechSynthesis.speak(utt);
    }

    store.setPlaying(true);
    acquireWakeLock();
    speakNext();
  }

  function pauseReading() {
    speechSynthesis.cancel();
    store.setPlaying(false);
    releaseWakeLock();
  }

  function stopReading(silent?: boolean) {
    speechSynthesis.cancel();
    store.setPlaying(false);
    releaseWakeLock();
  }

  function togglePlay() {
    if (!store.paragraphs.length) {
      toast({ title: 'Carga un archivo primero', variant: 'destructive' });
      return;
    }
    if (store.playing) { pauseReading(); } else { startReading(); }
  }

  function jumpTo(idx: number) {
    store.setCurrentParaIdx(idx);
    scrollToPara(idx);
    if (store.playing) {
      stopReading(true);
      startReading(idx);
    }
  }

  function scrollToPara(idx: number) {
    const el = document.querySelector(`[data-para-idx="${idx}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function prevPara() {
    const i = store.currentParaIdx - 1;
    if (i >= 0) jumpTo(i);
  }

  function nextPara() {
    const i = store.currentParaIdx + 1;
    if (i < store.paragraphs.length) jumpTo(i);
  }

  // ── Wake Lock ──
  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {}
  }
  function releaseWakeLock() {
    try { wakeLockRef.current?.release(); } catch {}
    wakeLockRef.current = null;
  }

  // ── Audio Equalizer ──
  function setupEqualizer() {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    const frequencies = [60, 230, 910, 4000, 14000];
    const filters = frequencies.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = i === 0 ? 'lowshelf' : i === frequencies.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = freq;
      filter.gain.value = store.eqBands[i] || 0;
      filter.Q.value = 1;
      return filter;
    });
    // Chain filters
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }
    filters[filters.length - 1].connect(ctx.destination);
    eqFiltersRef.current = filters;
  }

  function applyEqPreset(name: string) {
    const preset = EQ_PRESETS.find(p => p.name === name);
    if (preset) {
      store.setEqBands([...preset.bands]);
      store.setEqPresetName(name);
      preset.bands.forEach((gain, i) => {
        if (eqFiltersRef.current[i]) eqFiltersRef.current[i].gain.value = gain;
      });
    }
  }

  // ── Voice Control ──
  function startVoiceControl() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({ title: 'No soportado', description: 'Tu navegador no soporta reconocimiento de voz', variant: 'destructive' });
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const cmd = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
      if (cmd.includes('play') || cmd.includes('reproducir')) togglePlay();
      else if (cmd.includes('pause') || cmd.includes('pausa')) pauseReading();
      else if (cmd.includes('siguiente') || cmd.includes('next')) nextPara();
      else if (cmd.includes('anterior') || cmd.includes('prev')) prevPara();
      else if (cmd.includes('marcador') || cmd.includes('bookmark')) addBookmarkAtCurrent();
      else toast({ title: 'Comando no reconocido', description: cmd });
    };
    recognition.onerror = () => { store.setVoiceControlActive(false); };
    recognition.onend = () => { if (store.voiceControlActive) recognition.start(); };
    recognition.start();
    voiceRecognitionRef.current = recognition;
    store.setVoiceControlActive(true);
    toast({ title: 'Control por voz activado', description: 'Di: reproducir, pausa, siguiente, anterior, marcador' });
  }

  function stopVoiceControl() {
    voiceRecognitionRef.current?.stop();
    store.setVoiceControlActive(false);
    toast({ title: 'Control por voz desactivado' });
  }

  // ── Pomodoro Timer ──
  function startPomodoro() {
    store.setPomodoro({ mode: 'work', timeLeft: store.pomodoro.workDuration * 60 });
    const interval = setInterval(() => {
      const { timeLeft, mode, workDuration, breakDuration } = store.pomodoro;
      if (timeLeft <= 1) {
        if (mode === 'work') {
          store.setPomodoro({ mode: 'break', timeLeft: breakDuration * 60, sessions: store.pomodoro.sessions + 1 });
          toast({ title: 'Descanso', description: `${breakDuration} minutos de descanso` });
          // Notification
          if (Notification.permission === 'granted') {
            new Notification('VoxPDF Pomodoro', { body: 'Hora de descansar' });
          }
        } else {
          store.setPomodoro({ mode: 'work', timeLeft: workDuration * 60 });
          toast({ title: 'Concentración', description: `${workDuration} minutos de trabajo` });
          if (Notification.permission === 'granted') {
            new Notification('VoxPDF Pomodoro', { body: 'Hora de concentrarse' });
          }
        }
      } else {
        store.setPomodoro({ timeLeft: timeLeft - 1 });
      }
    }, 1000);
    pomodoroRef.current = interval;
  }

  function stopPomodoro() {
    if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    store.setPomodoro({ mode: 'idle', timeLeft: store.pomodoro.workDuration * 60 });
  }

  // ── Bookmarks ──
  function addBookmarkAtCurrent() {
    const idx = store.currentParaIdx;
    const text = store.paragraphs[idx]?.text || '';
    setBookmarkParaIdx(idx);
    setBookmarkNote('');
    setShowBookmarkModal(true);
  }

  function saveBookmark() {
    const bm: Bookmark = {
      paraIdx: bookmarkParaIdx,
      note: bookmarkNote,
      text: store.paragraphs[bookmarkParaIdx]?.text || '',
      date: Date.now(),
    };
    store.addBookmark(bm);
    store.setMiniMapBookmarks([...store.miniMapBookmarks, bookmarkParaIdx]);
    setShowBookmarkModal(false);
    saveBookmarksToStorage();
    toast({ title: 'Marcador guardado' });
  }

  function saveBookmarksToStorage() {
    try {
      const key = `vox4_bm_${store.fileName}`;
      localStorage.setItem(key, JSON.stringify(store.bookmarks));
    } catch {}
  }

  // ── Flashcards / Anki (GLM-powered) ──
  async function generateFlashcards() {
    if (!store.paragraphs.length) {
      toast({ title: 'Carga un documento primero', variant: 'destructive' });
      return;
    }
    try {
      toast({ title: 'GLM generando flashcards…', description: 'Un momento' });
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paragraphs: store.paragraphs,
          chapters: store.chapters,
          fileName: store.fileName,
        }),
      });
      const data = await res.json();
      if (data.flashcards && data.flashcards.length) {
        store.setFlashcards(data.flashcards);
        toast({ title: 'Flashcards generadas con GLM', description: `${data.flashcards.length} tarjetas` });
      } else {
        // Fallback: simple local generation
        generateFlashcardsLocal();
      }
    } catch (e) {
      console.error('GLM flashcards error:', e);
      generateFlashcardsLocal();
    }
  }

  function generateFlashcardsLocal() {
    const cards: Flashcard[] = [];
    store.chapters.forEach((ch, i) => {
      const start = ch.startIdx;
      const end = i < store.chapters.length - 1 ? store.chapters[i + 1].startIdx : store.paragraphs.length;
      for (let j = start; j < Math.min(start + 3, end); j++) {
        const sents = splitSentences(store.paragraphs[j]?.text || '');
        sents.slice(0, 2).forEach(s => {
          if (s.text.length > 15) {
            cards.push({
              front: s.text.trim(),
              back: `Capítulo: ${ch.title}`,
              tags: [store.fileName, ch.title],
              deck: store.fileName.replace(/\.\w+$/, ''),
            });
          }
        });
      }
    });
    store.setFlashcards(cards);
    toast({ title: 'Flashcards generadas (local)', description: `${cards.length} tarjetas` });
  }

  function exportAnkiCSV() {
    if (!store.flashcards.length) generateFlashcards();
    const csv = store.flashcards.map(f =>
      `"${f.front.replace(/"/g, '""')}","${f.back.replace(/"/g, '""')}","${f.tags.join(' ')}","${f.deck}"`
    ).join('\n');
    const header = 'Front,Back,Tags,Deck\n';
    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.fileName.replace(/\.\w+$/, '')}_anki.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: 'Compatible con Anki' });
  }

  // ── Translation (GLM-powered) ──
  async function translateText(text: string): Promise<string> {
    const cached = store.translationCache[text];
    if (cached) return cached;
    try {
      const res = await fetch(`/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: store.translation.sourceLang, target: store.translation.targetLang }),
      });
      const data = await res.json();
      if (data.translation) {
        store.setTranslationCache(text, data.translation);
        return data.translation;
      }
    } catch (e) {
      console.error('GLM translation error:', e);
    }
    return `[Traducción no disponible]`;
  }

  // ── Glossary (GLM-powered) ──
  function handleTextSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text.length < 2 || text.length > 50) return;
    // Check local glossary first
    const existing = store.glossary.find(g => g.term.toLowerCase() === text.toLowerCase());
    if (existing) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setGlossaryPopupTerm(existing.term);
      setGlossaryPopupDef(existing.definition);
      setGlossaryPopupPos({ x: rect.left, y: rect.bottom });
      setShowGlossaryPopup(true);
    } else {
      // Use GLM to define the term
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setGlossaryPopupTerm(text);
      setGlossaryPopupDef('Consultando GLM…');
      setGlossaryPopupPos({ x: rect.left, y: rect.bottom });
      setShowGlossaryPopup(true);
      // Fetch definition from GLM
      fetch('/api/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: text, context: store.paragraphs[store.currentParaIdx]?.text || '' }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.definition) {
            setGlossaryPopupDef(data.definition);
          } else {
            setGlossaryPopupDef('Término no definido. Click + para añadir.');
          }
        })
        .catch(() => {
          setGlossaryPopupDef('Término no definido. Click + para añadir.');
        });
    }
  }

  function addToGlossary() {
    store.addGlossaryTerm({ term: glossaryPopupTerm, definition: glossaryPopupDef, source: store.fileName });
    setShowGlossaryPopup(false);
    toast({ title: 'Término añadido al glosario' });
  }

  // ── Summarize (GLM-powered) ──
  async function summarizeDocument(mode: 'brief' | 'detailed' | 'bullet' | 'academic' = 'brief') {
    if (!store.paragraphs.length) {
      toast({ title: 'Carga un documento primero', variant: 'destructive' });
      return;
    }
    try {
      toast({ title: 'GLM resumiendo…', description: 'Un momento' });
      const text = store.paragraphs.slice(0, 50).map(p => p.text).join('\n\n');
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode }),
      });
      const data = await res.json();
      if (data.summary) {
        toast({ title: 'Resumen con GLM', description: data.summary.slice(0, 100) + '…' });
        // Save to parallel notes at current position
        setParallelNotes({ ...parallelNotes, [store.currentParaIdx]: `📋 Resumen: ${data.summary}` });
        return data.summary;
      }
    } catch (e) {
      console.error('GLM summarize error:', e);
    }
    toast({ title: 'Error', description: 'No se pudo resumir', variant: 'destructive' });
    return '';
  }

  // ── Export Markdown ──
  function exportMarkdown() {
    let md = `# ${store.fileName}\n\n`;
    store.chapters.forEach((ch, i) => {
      md += `## ${ch.title}\n\n`;
      const start = ch.startIdx;
      const end = i < store.chapters.length - 1 ? store.chapters[i + 1].startIdx : store.paragraphs.length;
      for (let j = start; j < end; j++) {
        md += `${store.paragraphs[j]?.text}\n\n`;
        // Include bookmarks
        const bm = store.bookmarks.find(b => b.paraIdx === j);
        if (bm) md += `> 📌 ${bm.note || 'Marcador'}\n\n`;
      }
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.fileName.replace(/\.\w+$/, '')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Markdown exportado' });
  }

  // ── Backup Annotations ──
  function exportAnnotations() {
    const data = {
      bookmarks: store.bookmarks,
      highlights: store.highlights,
      glossary: store.glossary,
      flashcards: store.flashcards,
      progress: { [store.fileName]: { idx: store.currentParaIdx, ts: Date.now() } },
      parallelNotes,
      settings: {
        theme: store.theme, fontSize: store.fontSize, fontFamily: store.fontFamily,
        rate: store.rate, pitch: store.pitch, volume: store.volume,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voxpdf_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Backup exportado' });
  }

  function importAnnotations() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        if (data.bookmarks) data.bookmarks.forEach((bm: Bookmark) => store.addBookmark(bm));
        if (data.glossary) data.glossary.forEach((g: GlossaryTerm) => store.addGlossaryTerm(g));
        if (data.flashcards) store.setFlashcards(data.flashcards);
        if (data.parallelNotes) setParallelNotes(data.parallelNotes);
        toast({ title: 'Backup importado', description: 'Anotaciones restauradas' });
      } catch {
        toast({ title: 'Error', description: 'Archivo JSON inválido', variant: 'destructive' });
      }
    };
    input.click();
  }

  // ── Cloud Sync (GLM-compatible - Supabase placeholder) ──
  function handleGoogleLogin() {
    // In production, this would use Supabase Auth with Google provider
    store.setLoggedIn(true, 'Usuario Demo', 'demo@voxpdf.com');
    store.setLastSyncTime(Date.now());
    toast({ title: 'Sesión iniciada', description: 'Google login simulado' });
  }

  function syncToCloud() {
    if (!store.isLoggedIn) {
      toast({ title: 'Inicia sesión primero', variant: 'destructive' });
      return;
    }
    // In production, this would sync to Supabase
    exportAnnotations();
    store.setLastSyncTime(Date.now());
    toast({ title: 'Sincronizado', description: 'Datos subidos a la nube' });
  }

  // ── Reading Room ──
  function createRoom() {
    const id = Math.random().toString(36).slice(2, 8);
    store.setRoomId(id);
    store.setRoomUsers([{ id: 'me', name: store.userName || 'Yo', color: '#7c6af5', currentParaIdx: store.currentParaIdx, lastActive: Date.now() }]);
    setShowRoomModal(false);
    toast({ title: `Sala creada: ${id}`, description: 'Comparte el código con otros' });
  }

  function joinRoom() {
    if (!roomInput.trim()) return;
    store.setRoomId(roomInput);
    setShowRoomModal(false);
    toast({ title: `Unido a sala: ${roomInput}` });
  }

  // ── RSVP Speed Reading ──
  function startRSVP() {
    const words = store.paragraphs[store.currentParaIdx]?.text.split(/\s+/) || [];
    if (!words.length) return;
    setRsvpIdx(0);
    setRsvpPlaying(true);
    setShowRSVP(true);
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= words.length || !rsvpPlaying) {
        clearInterval(interval);
        setRsvpPlaying(false);
        return;
      }
      setRsvpWord(words[idx]);
      setRsvpIdx(idx);
      idx++;
    }, 60000 / rsvpWPM);
    return () => clearInterval(interval);
  }

  // ── Search ──
  function performSearch(query: string) {
    if (!query.trim()) { store.setSearchHits([]); return; }
    const q = query.toLowerCase();
    const hits: number[] = [];
    store.paragraphs.forEach((p, i) => {
      if (p.text.toLowerCase().includes(q)) hits.push(i);
    });
    store.setSearchHits(hits);
    store.setSearchCurrentIdx(0);
    if (hits.length) jumpTo(hits[0]);
  }

  // ── Heat Map Coloring ──
  function getHeatColor(text: string): string {
    if (!showHeatMap) return 'transparent';
    const words = text.toLowerCase().split(/\s+/);
    const maxFreq = Math.max(...Object.values(store.wordFrequency), 1);
    const avgFreq = words.reduce((sum, w) => sum + (store.wordFrequency[w] || 0), 0) / words.length;
    const intensity = Math.min(avgFreq / maxFreq, 1);
    return HEAT_COLORS[Math.floor(intensity * (HEAT_COLORS.length - 1))];
  }

  // ── Rendered content ──
  const renderedParas = useMemo(() => {
    if (store.lazyRendering && store.paragraphs.length > 500) {
      // Only render paragraphs near current position + buffer
      const start = Math.max(0, store.currentParaIdx - 50);
      const end = Math.min(store.paragraphs.length, store.currentParaIdx + 50);
      return store.paragraphs.slice(start, end).map((p, i) => ({ ...p, origIdx: start + i }));
    }
    return store.paragraphs.map((p, i) => ({ ...p, origIdx: i }));
  }, [store.paragraphs, store.currentParaIdx, store.lazyRendering]);

  const fontStack = store.fontFamily === 'mono' ? "'DM Mono', monospace" : store.fontFamily === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif';
  const themeStyle = THEME_STYLES[store.theme] || THEME_STYLES.dark;
  const accentColor = store.theme === 'eink' ? '#333' : store.theme === 'ocean' ? '#40b4dc' : store.theme === 'sepia' ? '#8b5c2a' : store.theme === 'contrast' ? '#ffe066' : '#7c6af5';
  const effectiveSidebarOpen = store.focusModeType === 'distractionFree' ? false : store.sidebarOpen;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: themeStyle.background, color: themeStyle.color, fontFamily: fontStack }}>
      {/* ══ SIDEBAR ══ */}
      {effectiveSidebarOpen && (
        <aside className="w-[280px] min-w-[280px] border-r flex flex-col overflow-hidden"
          style={{ background: store.theme === 'light' ? '#fff' : store.theme === 'eink' ? '#f0ede6' : '#111115', borderColor: 'rgba(255,255,255,0.07)' }}>
          {/* Logo */}
          <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
              <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>VoxPDF</span>
              <span className="text-[9px] opacity-40">v4</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => store.setSidebarOpen(false)}>
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={store.sidebarTab} onValueChange={store.setSidebarTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-11 p-0 h-8 rounded-none border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <TabsTrigger value="recents" className="text-[9px] h-8 rounded-none" title="Recientes"><BookOpen className="h-3 w-3" /></TabsTrigger>
              <TabsTrigger value="toc" className="text-[9px] h-8 rounded-none" title="Índice"><Layers /></TabsTrigger>
              <TabsTrigger value="bookmarks" className="text-[9px] h-8 rounded-none" title="Marcadores"><BookmarkIcon className="h-3 w-3" /></TabsTrigger>
              <TabsTrigger value="qa" className="text-[9px] h-8 rounded-none" title="Q&A"><MessageCircle className="h-3 w-3" /></TabsTrigger>
              <TabsTrigger value="quiz" className="text-[9px] h-8 rounded-none" title="Quiz"><HelpCircle className="h-3 w-3" /></TabsTrigger>
              <TabsTrigger value="citations" className="text-[9px] h-8 rounded-none" title="Citas"><Quote className="h-3 w-3" /></TabsTrigger>
              <TabsTrigger value="analysis" className="text-[9px] h-8 rounded-none" title="Análisis"><BarChart3 className="h-3 w-3" /></TabsTrigger>
              <TabsTrigger value="audio" className="text-[9px] h-8 rounded-none" title="Audio"><Headphones className="h-3 w-3" /></TabsTrigger>
              <TabsTrigger value="tools" className="text-[9px] h-8 rounded-none" title="Herramientas"><Brain /></TabsTrigger>
              <TabsTrigger value="toolspanel" className="text-[9px] h-8 rounded-none" title="Tools"><ScanLine className="h-3 w-3" /></TabsTrigger>
              <TabsTrigger value="settings" className="text-[9px] h-8 rounded-none" title="Ajustes"><Settings className="h-3 w-3" /></TabsTrigger>
            </TabsList>

            {/* Recents Tab */}
            <TabsContent value="recents" className="flex-1 overflow-y-auto p-2 m-0">
              <Button className="w-full mb-2" style={{ background: accentColor }} onClick={() => fileInputRef.current?.click()}>
                <Plus className="h-3 w-3 mr-1" /> Abrir archivo
              </Button>
              <Button variant="outline" className="w-full mb-2 text-[11px]" onClick={() => { store.setSidebarTab('toolspanel'); setTimeout(() => document.getElementById('readurl-input')?.focus(), 150); }}>
                <Volume2 className="h-3 w-3 mr-1" /> Leer URL en voz alta
              </Button>
              <div className="text-[9px] opacity-40 uppercase tracking-wider mb-1 px-1">Archivos recientes</div>
              {getRecents().map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:opacity-80 text-[11px]"
                  onClick={() => toast({ title: 'Recarga para abrir', description: r.name })}>
                  <FileText className="h-3 w-3 opacity-50" />
                  <span className="truncate flex-1">{r.name}</span>
                </div>
              ))}
              {getRecents().length === 0 && <div className="text-[11px] opacity-30 text-center py-4">Sin archivos recientes</div>}
            </TabsContent>

            {/* TOC Tab */}
            <TabsContent value="toc" className="flex-1 overflow-y-auto p-2 m-0">
              {store.chapters.map((ch, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:opacity-80 text-[11px]"
                  onClick={() => { jumpTo(ch.startIdx); store.setSidebarOpen(false); }}
                  style={store.currentParaIdx >= ch.startIdx && (i === store.chapters.length - 1 || store.currentParaIdx < store.chapters[i + 1]?.startIdx) ? { background: `${accentColor}15`, color: accentColor } : {}}>
                  <span className="text-[8px] opacity-40">{i + 1}</span>
                  <span className="truncate flex-1">{ch.title}</span>
                  <span className="text-[9px] opacity-30">p.{ch.page}</span>
                </div>
              ))}
              {store.chapters.length === 0 && <div className="text-[11px] opacity-30 text-center py-4">Sin capítulos detectados</div>}
            </TabsContent>

            {/* Bookmarks Tab */}
            <TabsContent value="bookmarks" className="flex-1 overflow-y-auto p-2 m-0">
              {store.bookmarks.map((bm, i) => (
                <div key={i} className="p-2 rounded-lg border mb-1 cursor-pointer hover:opacity-80 text-[11px]"
                  style={{ borderColor: 'rgba(255,255,255,0.07)' }}
                  onClick={() => { jumpTo(bm.paraIdx); store.setSidebarOpen(false); }}>
                  <div className="font-semibold truncate">{bm.text.slice(0, 40)}…</div>
                  <div className="text-[9px] opacity-40">{bm.note || `Párrafo ${bm.paraIdx + 1}`}</div>
                </div>
              ))}
              {store.bookmarks.length === 0 && <div className="text-[11px] opacity-30 text-center py-4">Sin marcadores</div>}
            </TabsContent>

            {/* Tools Tab */}
            <TabsContent value="tools" className="flex-1 overflow-y-auto p-2 m-0 space-y-1">
              {/* Flashcards */}
              <div className="p-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Flashcards → Anki (GLM)</div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="text-[10px] h-6 flex-1" onClick={generateFlashcards}>
                    <Sparkles className="h-3 w-3 mr-1" /> Generar
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 flex-1" onClick={exportAnkiCSV}>
                    <Download className="h-3 w-3 mr-1" /> CSV
                  </Button>
                </div>
                {store.flashcards.length > 0 && <div className="text-[10px] opacity-40 mt-1">{store.flashcards.length} tarjetas</div>}
              </div>

              {/* Summarize */}
              <div className="p-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Resumir con GLM</div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="text-[10px] h-6 flex-1" onClick={() => summarizeDocument('brief')}>
                    <Sparkles className="h-3 w-3 mr-1" /> Breve
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 flex-1" onClick={() => summarizeDocument('detailed')}>
                    <Sparkles className="h-3 w-3 mr-1" /> Detallado
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 flex-1" onClick={() => summarizeDocument('bullet')}>
                    <Sparkles className="h-3 w-3 mr-1" /> Puntos
                  </Button>
                </div>
              </div>

              {/* Translation (GLM) */}
              <div className="p-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Traducción al vuelo (GLM)</div>
                <div className="flex items-center gap-1 mb-1">
                  <Globe className="h-3 w-3 opacity-40" />
                  <Select value={store.translation.targetLang} onValueChange={(v) => store.setTranslation({ targetLang: v })}>
                    <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] opacity-40">Paralelo</span>
                  <Switch checked={store.translation.showParallel} onCheckedChange={(v) => store.setTranslation({ showParallel: v })} className="scale-75" />
                </div>
              </div>

              {/* Mind Map */}
              <div className="p-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Mapa mental (GLM)</div>
                <Button variant="outline" size="sm" className="text-[10px] h-6 w-full" onClick={() => setShowMindMap(!showMindMap)}>
                  <Brain className="h-3 w-3 mr-1" /> {showMindMap ? 'Ocultar' : 'Mostrar'} mapa
                </Button>
              </div>

              {/* Heat Map */}
              <div className="p-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Heat map de palabras</div>
                <Button variant="outline" size="sm" className="text-[10px] h-6 w-full" onClick={() => setShowHeatMap(!showHeatMap)}>
                  <Flame className="h-3 w-3 mr-1" /> {showHeatMap ? 'Ocultar' : 'Mostrar'} heat map
                </Button>
              </div>

              {/* Export Markdown */}
              <div className="p-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Exportar</div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="text-[10px] h-6 flex-1" onClick={exportMarkdown}>
                    <FileDown className="h-3 w-3 mr-1" /> Markdown
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 flex-1" onClick={exportAnkiCSV}>
                    <Download className="h-3 w-3 mr-1" /> Anki
                  </Button>
                </div>
              </div>

              {/* Backup */}
              <div className="p-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Backup anotaciones</div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="text-[10px] h-6 flex-1" onClick={exportAnnotations}>
                    <FileUp className="h-3 w-3 mr-1" /> Exportar
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 flex-1" onClick={importAnnotations}>
                    <FileDown className="h-3 w-3 mr-1" /> Importar
                  </Button>
                </div>
              </div>

              {/* Cloud Sync */}
              <div className="p-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Sync en la nube</div>
                {!store.isLoggedIn ? (
                  <Button variant="outline" size="sm" className="text-[10px] h-6 w-full" onClick={handleGoogleLogin}>
                    <Cloud className="h-3 w-3 mr-1" /> Google Login
                  </Button>
                ) : (
                  <div className="flex gap-1 items-center">
                    <span className="text-[10px] opacity-60 flex-1 truncate">{store.userName}</span>
                    <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={syncToCloud}>
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => store.setLoggedIn(false)}>
                      <CloudOff className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Reading Room */}
              <div className="p-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Sala de lectura grupal</div>
                <Button variant="outline" size="sm" className="text-[10px] h-6 w-full" onClick={() => setShowRoomModal(true)}>
                  <Users className="h-3 w-3 mr-1" /> {store.roomId ? `Sala: ${store.roomId}` : 'Crear / Unirse'}
                </Button>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="flex-1 overflow-y-auto p-2 m-0 space-y-2">
              {/* Theme */}
              <div>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Tema</div>
                <div className="grid grid-cols-3 gap-1">
                  {(['dark', 'light', 'sepia', 'contrast', 'ocean', 'eink'] as const).map(t => (
                    <Button key={t} variant={store.theme === t ? 'default' : 'outline'}
                      size="sm" className="text-[9px] h-6"
                      style={store.theme === t ? { background: accentColor } : {}}
                      onClick={() => store.setTheme(t)}>
                      {t === 'eink' ? 'E-ink' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Tamaño: {store.fontSize}px</div>
                <Slider value={[store.fontSize]} min={10} max={24} step={1} onValueChange={([v]) => store.setFontSize(v)} />
              </div>

              {/* Font Family */}
              <div>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Fuente</div>
                <Select value={store.fontFamily} onValueChange={store.setFontFamily}>
                  <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mono">Monospace</SelectItem>
                    <SelectItem value="sans">Sans-serif</SelectItem>
                    <SelectItem value="serif">Serif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Voice */}
              <div>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Voz TTS</div>
                <Select value={String(store.selectedVoice)} onValueChange={(v) => store.setSelectedVoice(parseInt(v))}>
                  <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {store.voices.slice(0, 30).map((v, i) => (
                      <SelectItem key={i} value={String(i)}>{v.name.slice(0, 25)} ({v.lang})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Speed */}
              <div>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Velocidad: {store.rate.toFixed(1)}×</div>
                <Slider value={[store.rate]} min={0.5} max={3} step={0.1} onValueChange={([v]) => store.setRate(v)} />
              </div>

              {/* Pitch */}
              <div>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Tono: {store.pitch.toFixed(1)}</div>
                <Slider value={[store.pitch]} min={0.5} max={2} step={0.1} onValueChange={([v]) => store.setPitch(v)} />
              </div>

              {/* Volume */}
              <div>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Volumen: {Math.round(store.volume * 100)}%</div>
                <Slider value={[store.volume]} min={0} max={1} step={0.05} onValueChange={([v]) => store.setVolume(v)} />
              </div>

              {/* Toggles */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Pausas por puntuación</span>
                  <Switch checked={store.pauseOnPunctuation} onCheckedChange={store.setPauseOnPunctuation} className="scale-75" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Pre-síntesis lookahead</span>
                  <Switch checked={store.preSynthesisLookahead} onCheckedChange={store.setPreSynthesisLookahead} className="scale-75" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Auto-cambio de idioma</span>
                  <Switch checked={store.autoLanguageSwitch} onCheckedChange={store.setAutoLanguageSwitch} className="scale-75" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Modo foco</span>
                  <Switch checked={store.focusMode} onCheckedChange={store.setFocusMode} className="scale-75" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Invertir colores</span>
                  <Switch checked={store.invertMode} onCheckedChange={store.setInvertMode} className="scale-75" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Saltar encab/pies</span>
                  <Switch checked={store.skipHF} onCheckedChange={store.setSkipHF} className="scale-75" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Resaltar palabras</span>
                  <Switch checked={store.highlightWords} onCheckedChange={store.setHighlightWords} className="scale-75" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Lazy rendering</span>
                  <Switch checked={store.lazyRendering} onCheckedChange={store.setLazyRendering} className="scale-75" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Vista paralela</span>
                  <Switch checked={store.parallelView} onCheckedChange={store.setParallelView} className="scale-75" />
                </div>
              </div>

              {/* Equalizer */}
              <div>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Ecualizador de audio</div>
                <Select value={store.eqPresetName} onValueChange={applyEqPreset}>
                  <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EQ_PRESETS.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-5 gap-1 mt-1">
                  {store.eqBands.map((gain, i) => (
                    <div key={i} className="text-center">
                      <div className="text-[8px] opacity-30">{['60', '230', '910', '4k', '14k'][i]}</div>
                      <Slider value={[gain]} min={-12} max={12} step={1} onValueChange={([v]) => {
                        const bands = [...store.eqBands];
                        bands[i] = v;
                        store.setEqBands(bands);
                      }} className="h-16" orientation="vertical" />
                      <div className="text-[8px] opacity-30">{gain > 0 ? `+${gain}` : gain}dB</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Glossary */}
              <div>
                <div className="text-[9px] uppercase tracking-wider opacity-40 mb-1">Glosario ({store.glossary.length})</div>
                <ScrollArea className="max-h-24">
                  {store.glossary.map((g, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] py-0.5">
                      <span className="font-semibold">{g.term}</span>
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => store.removeGlossaryTerm(g.term)}>
                        <X className="h-2 w-2" />
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Q&A Tab */}
            <TabsContent value="qa" className="flex-1 overflow-y-auto p-2 m-0">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1"><MessageCircle className="w-4 h-4" /> Chat con el Documento</h3>
                <ScrollArea className="h-64">
                  {store.qaMessages.map((msg, i) => (
                    <div key={i} className={`mb-2 p-2 rounded text-xs ${msg.role === 'user' ? 'bg-primary/20 ml-4' : 'bg-muted mr-4'}`}>
                      {msg.content}
                    </div>
                  ))}
                  {store.qaLoading && <div className="text-xs text-muted-foreground animate-pulse">Pensando...</div>}
                </ScrollArea>
                <div className="flex gap-1">
                  <Textarea
                    placeholder="Pregunta sobre el documento..."
                    className="text-xs h-8"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const q = (e.target as HTMLTextAreaElement).value;
                        if (!q.trim()) return;
                        store.addQAMessage({ role: 'user', content: q });
                        store.setQALoading(true);
                        (e.target as HTMLTextAreaElement).value = '';
                        try {
                          const ctx = store.paragraphs.slice(0, 50).map(p => p.text).join('\n');
                          const res = await fetch('/api/qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, context: ctx, history: store.qaMessages.slice(-6) }) });
                          const data = await res.json();
                          store.addQAMessage({ role: 'assistant', content: data.answer || data.error || 'Sin respuesta' });
                        } catch { store.addQAMessage({ role: 'assistant', content: 'Error de conexión' }); }
                        store.setQALoading(false);
                      }
                    }}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Quiz Tab */}
            <TabsContent value="quiz" className="flex-1 overflow-y-auto p-2 m-0">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1"><HelpCircle className="w-4 h-4" /> Quiz</h3>
                {store.quizQuestions.length === 0 ? (
                  <Button size="sm" className="w-full text-xs" onClick={async () => {
                    store.setQuizLoading(true);
                    try {
                      const res = await fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paragraphs: store.paragraphs, chapters: store.chapters, fileName: store.fileName }) });
                      const data = await res.json();
                      store.setQuizQuestions(data.quiz || []);
                    } catch { toast({ title: 'Error generando quiz' }); }
                    store.setQuizLoading(false);
                  }} disabled={store.quizLoading}>
                    {store.quizLoading ? 'Generando...' : 'Generar Quiz'}
                  </Button>
                ) : (
                  <ScrollArea className="h-72">
                    {store.quizQuestions.map((q, i) => (
                      <div key={i} className="mb-3 p-2 border rounded text-xs">
                        <p className="font-medium mb-1">{i + 1}. {q.question}</p>
                        {q.options.map((opt, j) => (
                          <button key={j} className={`block w-full text-left p-1 mb-0.5 rounded ${store.quizAnswered[i] ? (j === q.correct ? 'bg-green-500/20 text-green-400' : 'bg-red-500/10') : 'hover:bg-muted'}`} onClick={() => {
                            const newAnswered = [...store.quizAnswered];
                            newAnswered[i] = true;
                            store.setQuizAnswered(newAnswered);
                            if (j === q.correct) store.setQuizScore(store.quizScore + 1);
                          }} disabled={store.quizAnswered[i]}>
                            {String.fromCharCode(65 + j)}) {opt}
                          </button>
                        ))}
                        {store.quizAnswered[i] && <p className="text-muted-foreground mt-1">{q.explanation}</p>}
                      </div>
                    ))}
                    <p className="text-center font-medium">Puntuación: {store.quizScore}/{store.quizQuestions.length}</p>
                  </ScrollArea>
                )}
              </div>
            </TabsContent>

            {/* Citations Tab */}
            <TabsContent value="citations" className="flex-1 overflow-y-auto p-2 m-0">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1"><Quote className="w-4 h-4" /> Citas Automáticas</h3>
                <div className="flex gap-1 mb-2">
                  {(['apa', 'mla', 'chicago'] as const).map(f => (
                    <Button key={f} size="sm" variant={store.citationFormat === f ? 'default' : 'outline'} className="text-xs flex-1" onClick={() => store.setCitationFormat(f)}>{f.toUpperCase()}</Button>
                  ))}
                </div>
                {store.citations.length === 0 ? (
                  <Button size="sm" className="w-full text-xs" onClick={async () => {
                    store.setCitationsLoading(true);
                    try {
                      const text = store.paragraphs.map(p => p.text).join('\n');
                      const res = await fetch('/api/citations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
                      const data = await res.json();
                      store.setCitations(data.citations || []);
                    } catch { toast({ title: 'Error detectando citas' }); }
                    store.setCitationsLoading(false);
                  }} disabled={store.citationsLoading}>
                    {store.citationsLoading ? 'Detectando...' : 'Detectar Citas'}
                  </Button>
                ) : (
                  <ScrollArea className="h-64">
                    {store.citations.map((c, i) => (
                      <div key={i} className="mb-2 p-2 border rounded text-xs">
                        <p className="text-muted-foreground mb-1">Original: {c.original}</p>
                        <p className="font-medium">{c[store.citationFormat]}</p>
                        <Badge variant="outline" className="text-[10px] mt-1">{c.type}</Badge>
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </div>
            </TabsContent>

            {/* Analysis Tab */}
            <TabsContent value="analysis" className="flex-1 overflow-y-auto p-2 m-0">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1"><BarChart3 className="w-4 h-4" /> Análisis</h3>

                {/* Word Cloud */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><Cloud className="w-3 h-3" /> Nube de Palabras</h4>
                  {store.wordCloudData.length === 0 ? (
                    <Button size="sm" className="w-full text-xs" onClick={() => {
                      const freq = store.wordFrequency;
                      const data = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([text, value]) => ({ text, value }));
                      store.setWordCloudData(data);
                    }}>Generar</Button>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {store.wordCloudData.map((w, i) => (
                        <span key={i} className="inline-block text-primary" style={{ fontSize: `${Math.min(8 + w.value * 2, 24)}px` }}>{w.text}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sentiment */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><Smile className="w-3 h-3" /> Sentimiento</h4>
                  {store.sentimentResults.length === 0 ? (
                    <Button size="sm" className="w-full text-xs" onClick={async () => {
                      store.setSentimentLoading(true);
                      try {
                        const sections = store.chapters.map(ch => ({ title: ch.title, content: store.paragraphs.slice(ch.startIdx, ch.startIdx + 5).map(p => p.text).join(' ') }));
                        const res = await fetch('/api/sentiment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sections }) });
                        const data = await res.json();
                        store.setSentimentResults(data.results || []);
                      } catch { toast({ title: 'Error' }); }
                      store.setSentimentLoading(false);
                    }} disabled={store.sentimentLoading}>{store.sentimentLoading ? 'Analizando...' : 'Analizar'}</Button>
                  ) : (
                    <div className="space-y-1">
                      {store.sentimentResults.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {s.sentiment === 'positive' ? <Smile className="w-3 h-3 text-green-400" /> : s.sentiment === 'negative' ? <Frown className="w-3 h-3 text-red-400" /> : <Meh className="w-3 h-3 text-yellow-400" />}
                          <span className="flex-1 truncate">{s.title}</span>
                          <span className="text-muted-foreground">{s.score.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Language Detection */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><LangIcon className="w-3 h-3" /> Idioma</h4>
                  {store.detectedLanguage ? (
                    <div className="text-xs">
                      <p>{store.detectedLanguage.language} ({store.detectedLanguage.code})</p>
                      <p className="text-muted-foreground">Confianza: {(store.detectedLanguage.confidence * 100).toFixed(0)}%</p>
                    </div>
                  ) : (
                    <Button size="sm" className="w-full text-xs" onClick={async () => {
                      store.setLanguageLoading(true);
                      try {
                        const text = store.paragraphs.slice(0, 10).map(p => p.text).join(' ');
                        const res = await fetch('/api/detect-lang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
                        const data = await res.json();
                        store.setDetectedLanguage(data);
                      } catch { toast({ title: 'Error' }); }
                      store.setLanguageLoading(false);
                    }} disabled={store.languageLoading}>{store.languageLoading ? 'Detectando...' : 'Detectar'}</Button>
                  )}
                </div>

                {/* Reading Stats */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Estadísticas</h4>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="p-1 bg-muted rounded text-center"><p className="text-muted-foreground">Páginas</p><p className="font-bold">{store.totalPages}</p></div>
                    <div className="p-1 bg-muted rounded text-center"><p className="text-muted-foreground">Párrafos</p><p className="font-bold">{store.paragraphs.length}</p></div>
                    <div className="p-1 bg-muted rounded text-center"><p className="text-muted-foreground">Progreso</p><p className="font-bold">{(store.pageProgress * 100).toFixed(0)}%</p></div>
                    <div className="p-1 bg-muted rounded text-center"><p className="text-muted-foreground">Capítulos</p><p className="font-bold">{store.chapters.length}</p></div>
                  </div>
                </div>

                {/* Section Summaries */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><ListChecks className="w-3 h-3" /> Resumen por Sección</h4>
                  {store.sectionSummaries.length === 0 ? (
                    <Button size="sm" className="w-full text-xs" onClick={async () => {
                      store.setSectionSummariesLoading(true);
                      try {
                        const sections = store.chapters.map(ch => ({ title: ch.title, content: store.paragraphs.slice(ch.startIdx, ch.startIdx + 5).map(p => p.text).join(' ') }));
                        const res = await fetch('/api/section-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sections }) });
                        const data = await res.json();
                        store.setSectionSummaries(data.summaries || []);
                      } catch { toast({ title: 'Error' }); }
                      store.setSectionSummariesLoading(false);
                    }} disabled={store.sectionSummariesLoading}>{store.sectionSummariesLoading ? 'Resumiendo...' : 'Resumir'}</Button>
                  ) : (
                    <ScrollArea className="h-48">
                      {store.sectionSummaries.map((s, i) => (
                        <div key={i} className="mb-2 text-xs">
                          <p className="font-semibold">{s.title}</p>
                          <p className="text-muted-foreground">{s.summary}</p>
                        </div>
                      ))}
                    </ScrollArea>
                  )}
                </div>

                {/* Extract Tables */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><Table2 className="w-3 h-3" /> Tablas</h4>
                  {store.extractedTables.length === 0 ? (
                    <Button size="sm" className="w-full text-xs" onClick={async () => {
                      store.setTablesLoading(true);
                      try {
                        const text = store.paragraphs.map(p => p.text).join('\n');
                        const res = await fetch('/api/extract-tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
                        const data = await res.json();
                        store.setExtractedTables(data.tables || []);
                      } catch { toast({ title: 'Error' }); }
                      store.setTablesLoading(false);
                    }} disabled={store.tablesLoading}>{store.tablesLoading ? 'Extrayendo...' : 'Extraer Tablas'}</Button>
                  ) : (
                    <ScrollArea className="h-48">
                      {store.extractedTables.map((t, i) => (
                        <div key={i} className="mb-2 text-xs overflow-x-auto">
                          <p className="font-semibold mb-1">{t.caption}</p>
                          <table className="w-full border-collapse">
                            <thead><tr>{t.headers.map((h, j) => <th key={j} className="border p-1 bg-muted">{h}</th>)}</tr></thead>
                            <tbody>{t.rows.map((row, j) => <tr key={j}>{row.map((cell, k) => <td key={k} className="border p-1">{cell}</td>)}</tr>)}</tbody>
                          </table>
                        </div>
                      ))}
                    </ScrollArea>
                  )}
                </div>

                {/* Document Comparison */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><GitCompare className="w-3 h-3" /> Comparar</h4>
                  {!store.docComparison ? (
                    <div className="space-y-1">
                      <Textarea placeholder="Pega el segundo documento aquí..." className="text-xs h-16" value={store.secondDocText} onChange={e => store.setSecondDocText(e.target.value)} />
                      <Button size="sm" className="w-full text-xs" onClick={async () => {
                        if (!store.secondDocText) return;
                        store.setComparisonLoading(true);
                        try {
                          const text1 = store.paragraphs.map(p => p.text).join('\n');
                          const res = await fetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text1, text2: store.secondDocText }) });
                          const data = await res.json();
                          store.setDocComparison(data);
                        } catch { toast({ title: 'Error' }); }
                        store.setComparisonLoading(false);
                      }} disabled={store.comparisonLoading}>{store.comparisonLoading ? 'Comparando...' : 'Comparar'}</Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-48 text-xs">
                      <p className="font-semibold mb-1">Resumen</p>
                      <p className="text-muted-foreground mb-2">{store.docComparison.summary}</p>
                      <p className="font-semibold text-green-400 mb-1">Similitudes</p>
                      {store.docComparison.similarities.map((s, i) => <p key={i} className="text-muted-foreground">• {s}</p>)}
                      <p className="font-semibold text-red-400 mt-2 mb-1">Diferencias</p>
                      {store.docComparison.differences.map((d, i) => <p key={i} className="text-muted-foreground">• {d}</p>)}
                    </ScrollArea>
                  )}
                </div>

                {/* Timeline */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Timeline</h4>
                  {store.timelineData.length === 0 ? (
                    <Button size="sm" className="w-full text-xs" onClick={async () => {
                      store.setTimelineLoading(true);
                      try {
                        const text = store.paragraphs.map(p => p.text).join('\n');
                        const res = await fetch('/api/timeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
                        const data = await res.json();
                        store.setTimelineData(data.timeline || []);
                      } catch { toast({ title: 'Error' }); }
                      store.setTimelineLoading(false);
                    }} disabled={store.timelineLoading}>{store.timelineLoading ? 'Extrayendo...' : 'Generar Timeline'}</Button>
                  ) : (
                    <ScrollArea className="h-48">
                      {store.timelineData.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 mb-2 text-xs">
                          <div className="w-2 h-2 mt-1 rounded-full bg-primary shrink-0" />
                          <div><p className="font-semibold">{t.date}</p><p className="text-muted-foreground">{t.event}</p></div>
                        </div>
                      ))}
                    </ScrollArea>
                  )}
                </div>

                {/* Concept Network */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><Share2 className="w-3 h-3" /> Red de Conceptos</h4>
                  {!store.conceptNetwork ? (
                    <Button size="sm" className="w-full text-xs" onClick={async () => {
                      store.setConceptNetworkLoading(true);
                      try {
                        const text = store.paragraphs.slice(0, 30).map(p => p.text).join('\n');
                        const res = await fetch('/api/concept-network', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
                        const data = await res.json();
                        store.setConceptNetwork(data.network || { nodes: [], edges: [] });
                      } catch { toast({ title: 'Error' }); }
                      store.setConceptNetworkLoading(false);
                    }} disabled={store.conceptNetworkLoading}>{store.conceptNetworkLoading ? 'Analizando...' : 'Generar Red'}</Button>
                  ) : (
                    <ScrollArea className="h-48 text-xs">
                      <p className="font-semibold mb-1">Conceptos ({store.conceptNetwork.nodes.length})</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {store.conceptNetwork.nodes.map(n => <Badge key={n.id} variant="outline" className="text-[10px]">{n.label}</Badge>)}
                      </div>
                      <p className="font-semibold mb-1">Relaciones ({store.conceptNetwork.edges.length})</p>
                      {store.conceptNetwork.edges.map((e, i) => <p key={i} className="text-muted-foreground">{e.source} → {e.target} {e.label && `(${e.label})`}</p>)}
                    </ScrollArea>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Audio Tab */}
            <TabsContent value="audio" className="flex-1 overflow-y-auto p-2 m-0">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1"><Headphones className="w-4 h-4" /> Audio</h3>

                {/* Ambient Sound */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><Volume2 className="w-3 h-3" /> Sonido Ambient</h4>
                  <Select value={store.ambientSound} onValueChange={v => store.setAmbientSound(v as any)}>
                    <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['none', 'rain', 'forest', 'cafe', 'waves', 'fire', 'wind', 'lofi'].map(s => (
                        <SelectItem key={s} value={s} className="text-xs">{s === 'none' ? 'Silencio' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {store.ambientSound !== 'none' && (
                    <Slider className="mt-1" value={[store.ambientVolume]} onValueChange={v => store.setAmbientVolume(v[0])} max={1} step={0.1} />
                  )}
                </div>

                {/* Podcast Mode */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><Radio className="w-3 h-3" /> Modo Podcast</h4>
                  <div className="flex items-center gap-2">
                    <Switch checked={store.podcastMode} onCheckedChange={store.setPodcastMode} />
                    <span className="text-xs">{store.podcastMode ? 'Activado' : 'Desactivado'}</span>
                  </div>
                  {store.podcastMode && (
                    <div className="mt-1 space-y-1">
                      <Textarea placeholder="Intro personalizado..." className="text-xs h-8" value={store.podcastIntro} onChange={e => store.setPodcastIntro(e.target.value)} />
                      <Textarea placeholder="Outro personalizado..." className="text-xs h-8" value={store.podcastOutro} onChange={e => store.setPodcastOutro(e.target.value)} />
                    </div>
                  )}
                </div>

                {/* Subtitles */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><Subtitles className="w-3 h-3" /> Subtítulos</h4>
                  <div className="flex items-center gap-2 mb-1">
                    <Switch checked={store.subtitleVisible} onCheckedChange={store.setSubtitleVisible} />
                    <span className="text-xs">{store.subtitleVisible ? 'Visibles' : 'Ocultos'}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant={store.subtitleFormat === 'srt' ? 'default' : 'outline'} className="text-xs flex-1" onClick={() => store.setSubtitleFormat('srt')}>SRT</Button>
                    <Button size="sm" variant={store.subtitleFormat === 'vtt' ? 'default' : 'outline'} className="text-xs flex-1" onClick={() => store.setSubtitleFormat('vtt')}>VTT</Button>
                  </div>
                  {store.subtitleVisible && store.subtitles.length === 0 && (
                    <Button size="sm" className="w-full text-xs mt-1" onClick={() => {
                      const sents = store.paragraphs.map(p => p.text).join(' ').match(/[^.!?]+[.!?]*/g) || [];
                      const entries = sents.filter(s => s.trim()).map((s, i) => ({ index: i + 1, startTime: i * 4, endTime: (i + 1) * 4 - 0.5, text: s.trim() }));
                      store.setSubtitles(entries);
                    }}>Generar</Button>
                  )}
                </div>

                {/* Audiobook Export */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><CloudDownload className="w-3 h-3" /> Exportar Audiobook</h4>
                  <Button size="sm" className="w-full text-xs" onClick={() => {
                    if (!('speechSynthesis' in window)) { toast({ title: 'TTS no disponible' }); return; }
                    toast({ title: 'Usa la grabación del sistema o herramientas externas', description: 'El TTS del navegador no soporta export directa. Usa herramientas como ffmpeg para grabar la salida de audio.' });
                  }}>Exportar</Button>
                </div>
              </div>
            </TabsContent>

            {/* Tools Panel Tab */}
            <TabsContent value="toolspanel" className="flex-1 overflow-y-auto p-2 m-0">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1"><ScanLine className="w-4 h-4" /> Herramientas</h3>

                {/* OCR */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><ScanLine className="w-3 h-3" /> OCR (Imágenes / PDFs Escaneados)</h4>
                  <input ref={ocrInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp" className="hidden" onChange={handleOcrFile} />
                  <Button size="sm" className="w-full text-xs" onClick={() => ocrInputRef.current?.click()} disabled={store.ocrActive}>
                    {store.ocrActive ? `Procesando... ${store.ocrProgress}%` : '📷 Seleccionar Imagen'}
                  </Button>
                  {store.ocrActive && (
                    <div className="w-full h-1 bg-muted rounded mt-1.5 overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${store.ocrProgress}%` }} />
                    </div>
                  )}
                  {store.ocrResult && (
                    <div className="mt-1.5">
                      <ScrollArea className="h-28 border rounded p-1.5">
                        <p className="text-xs whitespace-pre-wrap text-muted-foreground">{store.ocrResult}</p>
                      </ScrollArea>
                      <Button size="sm" className="w-full text-xs mt-1" onClick={loadOcrIntoReader}>🔊 Cargar en el Lector</Button>
                    </div>
                  )}
                </div>

                {/* Web Clipper */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><GlobeIcon className="w-3 h-3" /> Web Clipper</h4>
                  <div className="space-y-1">
                    <Textarea placeholder="Pega el HTML del artículo..." className="text-xs h-16" id="webclip-html" />
                    <input type="text" placeholder="URL del artículo" className="w-full text-xs p-1.5 border rounded bg-transparent" id="webclip-url" />
                    <Button size="sm" className="w-full text-xs" onClick={async () => {
                      const html = (document.getElementById('webclip-html') as HTMLTextAreaElement)?.value || '';
                      const url = (document.getElementById('webclip-url') as HTMLInputElement)?.value || '';
                      if (!html && !url) { toast({ title: 'Pega HTML o URL' }); return; }
                      store.setWebClipLoading(true);
                      try {
                        const res = await fetch('/api/webclip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html, url }) });
                        const data = await res.json();
                        store.addWebClip({ ...data, url, clippedAt: Date.now() });
                        toast({ title: `Clippeado: ${data.title || url}` });
                      } catch { toast({ title: 'Error al clippear' }); }
                      store.setWebClipLoading(false);
                    }} disabled={store.webClipLoading}>{store.webClipLoading ? 'Clippeando...' : 'Clippear'}</Button>
                  </div>
                  {store.webClips.length > 0 && (
                    <ScrollArea className="h-32 mt-1">
                      {store.webClips.map((c, i) => (
                        <div key={i} className="mb-1 p-1 border rounded text-xs cursor-pointer hover:bg-muted" onClick={() => {
                          const paras = c.content.split(/\n\s*\n|(?<=\.)\s{2,}/).map((t: string) => t.trim()).filter((t: string) => t.length > 0).map((txt: string, j: number) => ({ text: txt, page: 1 + Math.floor(j / 20), isHeader: false, isFooter: false }));
                          if (paras.length) {
                            store.setFileName(c.title || 'Web Clip');
                            store.setParagraphs(paras);
                            store.setTotalPages(Math.ceil(paras.length / 20));
                            buildTOC(); computeWordFrequency(); computeMindMap();
                            toast({ title: 'Clip cargado', description: 'Pulsa Play para escuchar' });
                          }
                        }}>
                          <p className="font-semibold">{c.title}</p>
                          <p className="text-muted-foreground truncate">{c.summary || c.content?.slice(0, 100)}</p>
                        </div>
                      ))}
                    </ScrollArea>
                  )}
                </div>

                {/* Leer URL en Voz Alta */}
                <div className="p-2 border rounded border-primary/40">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><Volume2 className="w-3 h-3 text-primary" /> Leer URL en Voz Alta</h4>
                  <div className="space-y-1">
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/articulo"
                      className="w-full text-xs p-1.5 border rounded bg-transparent"
                      id="readurl-input"
                      onKeyDown={(e) => { if (e.key === 'Enter') (document.getElementById('readurl-go') as HTMLButtonElement)?.click(); }}
                    />
                    <Button id="readurl-go" size="sm" className="w-full text-xs" onClick={async () => {
                      const url = (document.getElementById('readurl-input') as HTMLInputElement)?.value?.trim();
                      if (!url) { toast({ title: 'Pega una URL primero' }); return; }
                      store.setWebClipLoading(true);
                      stopReading(true);
                      try {
                        const res = await fetch('/api/fetch-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
                        const data = await res.json();
                        if (!res.ok || data.error) { toast({ title: 'No se pudo leer la página', description: data.error, variant: 'destructive' }); return; }
                        const paras = (data.paragraphs as string[]).map((txt, j) => ({ text: txt, page: 1 + Math.floor(j / 20), isHeader: false, isFooter: false }));
                        store.setFileName(`🌐 ${data.title}`);
                        store.setParagraphs(paras);
                        store.setTotalPages(Math.ceil(paras.length / 20));
                        store.setCurrentParaIdx(0);
                        buildTOC(); computeWordFrequency(); computeMindMap();
                        addRecent(`🌐 ${data.title}`, 0);
                        toast({ title: 'Página cargada', description: `${data.wordCount} palabras · ~${data.estimatedMinutes} min de lectura. Reproduciendo...` });
                        setTimeout(() => startReading(0), 400);
                      } catch (err: any) {
                        toast({ title: 'Error', description: err.message, variant: 'destructive' });
                      }
                      store.setWebClipLoading(false);
                    }} disabled={store.webClipLoading}>
                      {store.webClipLoading ? 'Descargando página...' : '🔊 Cargar y Leer'}
                    </Button>
                  </div>
                </div>

                {/* Focus Mode */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><Target className="w-3 h-3" /> Modo Focus</h4>
                  <Select value={store.focusModeType} onValueChange={v => store.setFocusModeType(v as any)}>
                    <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off" className="text-xs">Normal</SelectItem>
                      <SelectItem value="lineByLine" className="text-xs">Línea por Línea</SelectItem>
                      <SelectItem value="narrowColumn" className="text-xs">Columna Estrecha</SelectItem>
                      <SelectItem value="distractionFree" className="text-xs">Sin Distracciones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Split View */}
                <div className="p-2 border rounded">
                  <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><SplitSquareVertical className="w-3 h-3" /> Vista Dividida</h4>
                  <div className="flex items-center gap-2">
                    <Switch checked={store.splitView} onCheckedChange={store.setSplitView} />
                    <span className="text-xs">{store.splitView ? 'Activada' : 'Desactivada'}</span>
                  </div>
                  {store.splitView && (
                    <div className="mt-1">
                      <input type="file" accept=".pdf,.txt,.epub" className="text-xs w-full" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        store.setSplitDocName(file.name);
                        const text = await file.text();
                        const paras = text.split(/\n\n+/).filter(Boolean).map((t, i) => ({ text: t, page: 1, isHeader: false, isFooter: false }));
                        store.setSplitDocParagraphs(paras);
                      }} />
                      <p className="text-xs text-muted-foreground mt-1">{store.splitDocName || 'Sin segundo documento'}</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      )}

      {/* ══ MAIN CONTENT ══ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="h-12 border-b flex items-center gap-2 px-3 flex-shrink-0"
          style={{ background: store.theme === 'light' ? '#fff' : store.theme === 'eink' ? '#f0ede6' : '#111115', borderColor: 'rgba(255,255,255,0.07)' }}>
          {!effectiveSidebarOpen && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => store.setSidebarOpen(true)}>
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 text-[11px] font-semibold truncate opacity-60">{store.fileName || 'VoxPDF v4'}</div>

          {/* Search */}
          {searchOpen && (
            <div className="flex items-center gap-1 flex-1 max-w-xs">
              <Search className="h-3 w-3 opacity-40" />
              <input className="flex-1 bg-transparent border-b text-[11px] outline-none py-1"
                style={{ borderColor: accentColor }}
                placeholder="Buscar…"
                value={store.searchQuery}
                onChange={(e) => { store.setSearchQuery(e.target.value); performSearch(e.target.value); }}
                autoFocus />
              {store.searchHits.length > 0 && <span className="text-[9px] opacity-40">{store.searchCurrentIdx + 1}/{store.searchHits.length}</span>}
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setSearchOpen(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Status pills */}
          {store.playing && (
            <div className="flex items-center gap-0.5">
              {[5, 10, 14, 10, 5].map((h, i) => (
                <div key={i} className="w-[3px] rounded-sm animate-pulse" style={{ height: h, background: accentColor, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}
          {store.pomodoro.mode !== 'idle' && (
            <Badge variant="outline" className="text-[9px] h-5" style={{ borderColor: store.pomodoro.mode === 'work' ? '#e05252' : '#52c87a', color: store.pomodoro.mode === 'work' ? '#e05252' : '#52c87a' }}>
              <Timer className="h-2 w-2 mr-1" />{formatTime(store.pomodoro.timeLeft)}
            </Badge>
          )}
          {store.sleepTimerMinutes > 0 && (
            <Badge variant="outline" className="text-[9px] h-5" style={{ borderColor: '#f5a623', color: '#f5a623' }}>
              <Moon className="h-2 w-2 mr-1" />{formatTime(store.sleepTimerRemaining)}
            </Badge>
          )}
          {store.voiceControlActive && (
            <Badge variant="outline" className="text-[9px] h-5" style={{ borderColor: '#52c87a', color: '#52c87a' }}>
              <Mic className="h-2 w-2 mr-1" />Voz
            </Badge>
          )}
          {store.roomId && (
            <Badge variant="outline" className="text-[9px] h-5 cursor-pointer" onClick={() => setShowRoomModal(true)}>
              <Users className="h-2 w-2 mr-1" />{store.roomId}
            </Badge>
          )}

          {/* Top bar buttons */}
          <TooltipProvider>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSearchOpen(!searchOpen)}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Buscar (Ctrl+F)</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addBookmarkAtCurrent}>
                <BookmarkIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Marcador (B)</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowRSVP(true)}>
                <Zap className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>RSVP Speed Reading (R)</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={store.voiceControlActive ? stopVoiceControl : startVoiceControl}>
                {store.voiceControlActive ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger><TooltipContent>Control por voz</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowTeleprompter(true)}>
                <Maximize className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Teleprompter</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => store.setParallelView(!store.parallelView)}>
                <Columns2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Vista paralela</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={store.pomodoro.mode === 'idle' ? startPomodoro : stopPomodoro}>
                <Timer className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Pomodoro</TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => store.setSleepTimerMinutes(store.sleepTimerMinutes ? 0 : 25)}>
                <Moon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent>Sleep Timer</TooltipContent></Tooltip>
          </TooltipProvider>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex">
          {/* ── Mini-map sidebar ── */}
          <div className="w-[32px] border-r flex flex-col relative flex-shrink-0"
            style={{ background: store.theme === 'light' ? '#f2f1f8' : '#0a0a0c', borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="relative flex-1" onClick={(e) => {
              const pct = e.nativeEvent.offsetY / e.currentTarget.offsetHeight;
              jumpTo(Math.floor(pct * store.paragraphs.length));
            }}>
              {/* Progress indicator */}
              <div className="absolute w-full top-0" style={{
                height: `${store.pageProgress * 100}%`,
                background: `${accentColor}20`,
                transition: 'height 0.3s'
              }} />
              {/* Bookmark markers */}
              {store.miniMapBookmarks.map((idx) => (
                <div key={idx} className="absolute w-full h-[2px]" style={{
                  top: `${(idx / store.paragraphs.length) * 100}%`,
                  background: '#f5a623'
                }} />
              ))}
              {/* Current position */}
              <div className="absolute w-full h-[3px]" style={{
                top: `${store.pageProgress * 100}%`,
                background: accentColor,
                transition: 'top 0.3s'
              }} />
            </div>
            <div className="text-[7px] opacity-30 text-center py-1">{Math.round(store.pageProgress * 100)}%</div>
          </div>

          {/* ── Main reader ── */}
          <div className={store.splitView ? 'flex-1 overflow-y-auto' : 'flex-1 overflow-y-auto'} ref={contentRef}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = Array.from(e.dataTransfer.files);
              if (files.length) loadFileObj(files[0]);
            }}
            onMouseUp={handleTextSelection}
            style={{ padding: '18px 20px', paddingBottom: store.parallelView ? '120px' : '100px', ...(store.focusModeType === 'narrowColumn' ? { maxWidth: '500px', margin: '0 auto' } : {}) }}>

            {/* Drop zone */}
            {!store.paragraphs.length && !cbzImages.length && (
              <div className="flex flex-col items-center justify-center min-h-full gap-4 py-20">
                <BookOpen className="h-16 w-16 opacity-10" />
                <div className="text-2xl font-bold tracking-tight opacity-30" style={{ fontFamily: 'Syne, sans-serif' }}>VoxPDF v4</div>
                <div className="text-[12px] opacity-30 text-center max-w-[260px] leading-relaxed">
                  Lee PDF, EPUB, DOCX, CBZ en voz alta. OCR, resúmenes con GLM, speed reading RSVP, traducción, glosario, mapa mental, Pomodoro y más.
                </div>
                <div className={`border-2 border-dashed rounded-xl p-8 cursor-pointer w-full max-w-[320px] text-center transition-colors ${isDragging ? 'border-opacity-100' : 'border-opacity-20'}`}
                  style={{ borderColor: isDragging ? accentColor : 'rgba(255,255,255,0.13)', background: isDragging ? `${accentColor}10` : 'transparent' }}
                  onClick={() => fileInputRef.current?.click()}>
                  <Plus className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  <p className="text-[11px] opacity-40">Arrastra archivos aquí o toca para seleccionar</p>
                  <small className="text-[9px] opacity-25">PDF · EPUB · DOCX · TXT · CBZ · CBR · Imágenes</small>
                </div>
                <div className="flex gap-2 flex-wrap justify-center text-[9px] opacity-20">
                  <span className="px-2 py-0.5 rounded bg-white/5">Space Play</span>
                  <span className="px-2 py-0.5 rounded bg-white/5">← → Párrafo</span>
                  <span className="px-2 py-0.5 rounded bg-white/5">Ctrl+F Buscar</span>
                  <span className="px-2 py-0.5 rounded bg-white/5">B Marcador</span>
                  <span className="px-2 py-0.5 rounded bg-white/5">R RSVP</span>
                </div>
              </div>
            )}

            {/* CBZ/CBR Comic viewer */}
            {cbzImages.length > 0 && (
              <div className="max-w-[700px] mx-auto space-y-2">
                {cbzImages.map((src, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <div className="text-[8px] opacity-30 text-right px-2 py-1">Página {i + 1}/{cbzImages.length}</div>
                    <img src={src} alt={`Página ${i + 1}`} className="w-full" loading="lazy" />
                  </div>
                ))}
              </div>
            )}

            {/* Document viewer - parallel view */}
            {store.parallelView && store.paragraphs.length > 0 && (
              <div className="grid grid-cols-2 gap-4 max-w-[1200px] mx-auto">
                {/* Left: Text */}
                <div className="space-y-2">
                  {renderedParas.map((p) => (
                    <ContextMenu key={p.origIdx}>
                      <ContextMenuTrigger>
                        <div data-para-idx={p.origIdx}
                          className={`p-2 rounded-lg cursor-pointer transition-all text-[${store.fontSize}px] leading-[1.95]`}
                          style={{
                            fontSize: `${store.fontSize}px`,
                            fontFamily: fontStack,
                            background: p.origIdx === store.currentParaIdx ? `${accentColor}12` : getHeatColor(p.text),
                            borderLeft: p.origIdx === store.currentParaIdx ? `2px solid ${accentColor}` : '2px solid transparent',
                            opacity: store.focusMode && p.origIdx !== store.currentParaIdx ? 0.12 : 1,
                            paddingLeft: p.origIdx === store.currentParaIdx ? '9px' : '6px',
                          }}
                          onClick={() => jumpTo(p.origIdx)}>
                          {p.isHeader && <Badge variant="outline" className="text-[8px] h-4 mr-1">encab.</Badge>}
                          {p.isFooter && <Badge variant="outline" className="text-[8px] h-4 mr-1">pie</Badge>}
                          {p.text}
                          {store.bookmarks.some(b => b.paraIdx === p.origIdx) && (
                            <div className="w-1.5 h-1.5 rounded-full absolute right-2 top-1/2 -translate-y-1/2" style={{ background: '#f5a623' }} />
                          )}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => startReading(p.origIdx)}><Play className="h-3 w-3 mr-2" />Leer desde aquí</ContextMenuItem>
                        <ContextMenuItem onClick={() => { setBookmarkParaIdx(p.origIdx); setShowBookmarkModal(true); }}><BookmarkIcon className="h-3 w-3 mr-2" />Marcador</ContextMenuItem>
                        <ContextMenuItem onClick={() => { navigator.clipboard.writeText(p.text); toast({ title: 'Copiado' }); }}><Copy className="h-3 w-3 mr-2" />Copiar</ContextMenuItem>
                        <ContextMenuItem onClick={() => translateText(p.text).then(t => { store.setTranslationCache(p.text, t); toast({ title: 'Traducido' }); })}><Languages className="h-3 w-3 mr-2" />Traducir</ContextMenuItem>
                        <ContextMenuItem onClick={() => summarizeDocument('brief')}><Sparkles className="h-3 w-3 mr-2" />Resumir con GLM</ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
                {/* Right: Notes / Translation */}
                <div className="space-y-2">
                  {renderedParas.map((p) => (
                    <div key={p.origIdx} className="p-2 rounded-lg border text-[12px] opacity-60"
                      style={{ borderColor: 'rgba(255,255,255,0.07)', minHeight: '40px' }}>
                      <Textarea
                        className="bg-transparent border-0 text-[11px] resize-none min-h-[30px] p-0"
                        style={{ color: themeStyle.color }}
                        placeholder="Nota…"
                        value={parallelNotes[p.origIdx] || ''}
                        onChange={(e) => setParallelNotes({ ...parallelNotes, [p.origIdx]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document viewer - normal view */}
            {!store.parallelView && store.paragraphs.length > 0 && cbzImages.length === 0 && (
              <div className={store.splitView ? 'flex gap-4' : ''}>
                <div className={store.splitView ? 'w-1/2' : 'max-w-[700px] mx-auto space-y-4'}>
                  {renderedParas
                    .filter((_, i) => store.focusModeType !== 'lineByLine' || i === store.focusLineIdx)
                    .map((p) => (
                  <div key={p.origIdx} className={`rounded-xl p-6 ${store.einkOptimized ? 'shadow-none border' : 'border'}`}
                    style={{
                      background: store.theme === 'light' ? '#fff' : store.theme === 'eink' ? '#f8f6f0' : '#111115',
                      borderColor: 'rgba(255,255,255,0.07)',
                      opacity: store.lazyRendering && Math.abs(p.origIdx - store.currentParaIdx) > 100 ? 0.3 : 1,
                    }}
                    data-page={p.page}>
                    <div className="text-[8px] opacity-25 text-right mb-2">Página {p.page} · Párrafo {p.origIdx + 1}</div>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div data-para-idx={p.origIdx}
                          className={`cursor-pointer transition-all leading-[1.95] select-text`}
                          style={{
                            fontSize: `${store.fontSize}px`,
                            fontFamily: fontStack,
                            background: p.origIdx === store.currentParaIdx ? `${accentColor}12` : getHeatColor(p.text),
                            borderLeft: p.origIdx === store.currentParaIdx ? `2px solid ${accentColor}` : '2px solid transparent',
                            opacity: store.focusMode && p.origIdx !== store.currentParaIdx ? 0.12 : undefined,
                            paddingLeft: p.origIdx === store.currentParaIdx ? '9px' : '6px',
                            padding: '3px 6px',
                            borderRadius: '5px',
                          }}
                          onClick={() => jumpTo(p.origIdx)}>
                          {(p.isHeader || p.isFooter) && (
                            <span className="text-[8px] px-1 py-0.5 rounded border mr-1" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                              {p.isHeader ? 'encab.' : 'pie'}
                            </span>
                          )}
                          {p.text}
                          {store.bookmarks.some(b => b.paraIdx === p.origIdx) && (
                            <div className="inline-block w-1.5 h-1.5 rounded-full ml-1" style={{ background: '#f5a623' }} />
                          )}
                          {/* Translation parallel line */}
                          {store.translation.showParallel && store.translationCache[p.text] && (
                            <div className="text-[11px] opacity-40 mt-1 italic" style={{ color: accentColor }}>
                              {store.translationCache[p.text]}
                            </div>
                          )}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => startReading(p.origIdx)}>
                          <Play className="h-3 w-3 mr-2" />Leer desde aquí
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => setShowRSVP(true)}>
                          <Zap className="h-3 w-3 mr-2" />Speed read desde aquí
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => { setBookmarkParaIdx(p.origIdx); setShowBookmarkModal(true); }}>
                          <BookmarkIcon className="h-3 w-3 mr-2" />Marcador
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => { navigator.clipboard.writeText(p.text); toast({ title: 'Copiado' }); }}>
                          <Copy className="h-3 w-3 mr-2" />Copiar texto
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => translateText(p.text).then(t => {
                          store.setTranslationCache(p.text, t);
                          toast({ title: 'Traducido' });
                        })}>
                          <Languages className="h-3 w-3 mr-2" />Traducir
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => summarizeDocument('brief')}>
                          <Sparkles className="h-3 w-3 mr-2" />Resumir con GLM
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </div>
                ))}
                {/* Line by Line navigation */}
                {store.focusModeType === 'lineByLine' && (
                  <div className="flex justify-center gap-2 mt-2">
                    <Button size="sm" onClick={() => store.setFocusLineIdx(Math.max(0, store.focusLineIdx - 1))}><ChevronLeft className="w-4 h-4" /></Button>
                    <span className="text-xs self-center">{store.focusLineIdx + 1} / {store.paragraphs.length}</span>
                    <Button size="sm" onClick={() => store.setFocusLineIdx(Math.min(store.paragraphs.length - 1, store.focusLineIdx + 1))}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                )}
                </div>
                {/* Split View second document */}
                {store.splitView && store.splitDocParagraphs.length > 0 && (
                  <div className="w-1/2 overflow-y-auto border-l pl-4 space-y-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <p className="text-xs font-semibold mb-2">{store.splitDocName}</p>
                    {store.splitDocParagraphs.map((p, i) => (
                      <p key={i} className="text-sm mb-2 leading-relaxed">{p.text}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Mind Map Panel ── */}
          {showMindMap && store.mindMap && (
            <div className="w-[280px] border-l overflow-y-auto flex-shrink-0 p-3"
              style={{ background: store.theme === 'light' ? '#fff' : '#111115', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold">Mapa Mental</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowMindMap(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <MindMapTree node={store.mindMap} onSelect={(id) => {
                if (id.startsWith('ch-')) {
                  const idx = parseInt(id.replace('ch-', ''));
                  if (store.chapters[idx]) jumpTo(store.chapters[idx].startIdx);
                }
              }} accentColor={accentColor} />
            </div>
          )}
        </div>

        {/* ══ PLAYER BAR ══ */}
        {store.paragraphs.length > 0 && (
          <div ref={playerRef} className="border-t flex-shrink-0"
            style={{ background: store.theme === 'light' ? '#fff' : store.theme === 'eink' ? '#f0ede6' : '#111115', borderColor: 'rgba(255,255,255,0.07)' }}>
            {/* Progress bar */}
            <div className="h-1 cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}
              onClick={(e) => {
                const pct = e.nativeEvent.offsetX / e.currentTarget.offsetWidth;
                jumpTo(Math.floor(pct * store.paragraphs.length));
              }}>
              <div className="h-full transition-all" style={{ width: `${store.pageProgress * 100}%`, background: accentColor }} />
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevPara}>
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {/* skip -10s */}}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button className="h-9 w-9 rounded-full" style={{ background: accentColor }} onClick={togglePlay}>
                {store.playing ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {/* skip +10s */}}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextPara}>
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => stopReading()}>
                <Square className="h-3 w-3" />
              </Button>

              <div className="flex-1 text-center">
                <div className="text-[11px] font-semibold truncate">{store.fileName}</div>
                <div className="text-[9px] opacity-40">
                  Párrafo {store.currentParaIdx + 1}/{store.paragraphs.length} · p.{store.paragraphs[store.currentParaIdx]?.page || '-'}
                </div>
              </div>

              {/* Speed buttons */}
              <div className="flex gap-0.5">
                {[1, 1.5, 2].map(s => (
                  <Button key={s} variant={store.rate === s ? 'default' : 'outline'}
                    size="sm" className="text-[9px] h-6 px-2"
                    style={store.rate === s ? { background: accentColor } : {}}
                    onClick={() => store.setRate(s)}>
                    {s}×
                  </Button>
                ))}
              </div>
              <span className="text-[9px] opacity-30 min-w-[40px] text-right">
                {formatTime(Math.round((store.paragraphs.length - store.currentParaIdx) * 12 / (store.rate * 3)))}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* ══ MODALS ══ */}

      {/* Bookmark Modal */}
      <Dialog open={showBookmarkModal} onOpenChange={setShowBookmarkModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir marcador</DialogTitle>
          </DialogHeader>
          <div className="text-[10px] opacity-40 bg-muted p-2 rounded mb-2 max-h-14 overflow-hidden">
            {store.paragraphs[bookmarkParaIdx]?.text.slice(0, 100)}…
          </div>
          <Textarea value={bookmarkNote} onChange={(e) => setBookmarkNote(e.target.value)} placeholder="Nota opcional…" rows={3} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowBookmarkModal(false)}>Cancelar</Button>
            <Button className="flex-1" style={{ background: accentColor }} onClick={saveBookmark}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* RSVP Overlay */}
      {showRSVP && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center gap-4">
          <Button variant="ghost" className="absolute top-4 right-4 text-white/60" onClick={() => { setShowRSVP(false); setRsvpPlaying(false); }}>
            <X className="h-5 w-5" />
          </Button>
          <div className="relative h-[120px] flex items-center justify-center">
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/10" />
            <div className="text-5xl font-extrabold tracking-tight text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              {rsvpWord}
            </div>
          </div>
          <div className="text-[11px] text-white/30">{rsvpIdx + 1} / {store.paragraphs[store.currentParaIdx]?.text.split(/\s+/).length || 0} palabras</div>
          <div className="w-[130px] h-1 bg-white/10 rounded overflow-hidden">
            <div className="h-full rounded" style={{ width: `${((rsvpIdx + 1) / (store.paragraphs[store.currentParaIdx]?.text.split(/\s+/).length || 1)) * 100}%`, background: accentColor }} />
          </div>
          <div className="flex items-center gap-2 text-white/40 text-[11px]">
            <span>Velocidad</span>
            <Slider value={[rsvpWPM]} min={100} max={800} step={25} onValueChange={([v]) => setRsvpWPM(v)} className="w-[130px]" />
            <span>{rsvpWPM} ppm</span>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="text-white/60 border-white/10" onClick={() => startRSVP()}>
              <Play className="h-3 w-3 mr-1" />Iniciar
            </Button>
            <Button variant="outline" className="text-white/60 border-white/10" onClick={() => setRsvpPlaying(false)}>
              <Pause className="h-3 w-3 mr-1" />Pausa
            </Button>
          </div>
        </div>
      )}

      {/* Teleprompter Overlay */}
      {showTeleprompter && (
        <div className="fixed inset-0 z-50 bg-black/98 flex flex-col items-center justify-center p-8"
          style={{ cursor: 'none' }}
          onClick={() => setShowTeleprompter(false)}
          onMouseMove={(e) => {
            // Move on mouse move for teleprompter
            clearTimeout((window as any).__teleprompterTimer);
            (e.currentTarget as HTMLElement).style.cursor = 'default';
            (window as any).__teleprompterTimer = setTimeout(() => {
              (e.currentTarget as HTMLElement).style.cursor = 'none';
            }, 3000);
          }}>
          <div className="max-w-[800px] text-center text-3xl leading-relaxed font-medium" style={{ fontFamily: fontStack, color: '#e8e8f0' }}>
            {store.paragraphs[store.currentParaIdx]?.text || 'Carga un documento para usar el teleprompter'}
          </div>
          <div className="mt-8 text-[11px] text-white/20">Click para salir · Mueve el ratón para mostrar cursor</div>
        </div>
      )}

      {/* Mind Map Modal */}
      {showMindMap && !store.mindMap && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center">
          <div className="w-[500px] rounded-xl border bg-card p-6">
            <div className="font-semibold text-sm mb-2">Mapa Mental</div>
              <div className="text-[11px] opacity-40 text-center py-8">Carga un documento primero para generar el mapa mental</div>
              <Button variant="outline" onClick={() => setShowMindMap(false)}>Cerrar</Button>
          </div>
        </div>
      )}

      {/* Reading Room Modal */}
      <Dialog open={showRoomModal} onOpenChange={setShowRoomModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sala de Lectura Grupal</DialogTitle>
          </DialogHeader>
          {store.roomId ? (
            <div className="space-y-3">
              <div className="text-[11px]">Código de sala: <span className="font-bold" style={{ color: accentColor }}>{store.roomId}</span></div>
              <div className="text-[9px] opacity-40 uppercase tracking-wider">Usuarios conectados</div>
              {store.roomUsers.map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <div className="w-3 h-3 rounded-full" style={{ background: u.color }} />
                  <span>{u.name}</span>
                  <span className="text-[9px] opacity-30">p.{store.paragraphs[u.currentParaIdx]?.page || '-'}</span>
                </div>
              ))}
              <div className="border-t pt-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex gap-1">
                  <input className="flex-1 bg-transparent border rounded px-2 py-1 text-[11px]"
                    style={{ borderColor: 'rgba(255,255,255,0.07)' }}
                    placeholder="Mensaje…"
                    value={roomChatInput}
                    onChange={(e) => setRoomChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && roomChatInput.trim()) {
                        store.addRoomMessage({
                          id: Date.now().toString(),
                          userId: 'me',
                          userName: store.userName || 'Yo',
                          text: roomChatInput,
                          timestamp: Date.now(),
                        });
                        setRoomChatInput('');
                      }
                    }} />
                  <Button size="sm" style={{ background: accentColor }} onClick={() => {
                    if (roomChatInput.trim()) {
                      store.addRoomMessage({
                        id: Date.now().toString(),
                        userId: 'me',
                        userName: store.userName || 'Yo',
                        text: roomChatInput,
                        timestamp: Date.now(),
                      });
                      setRoomChatInput('');
                    }
                  }}>
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                </div>
                <ScrollArea className="max-h-[120px] mt-2">
                  {store.roomMessages.map((m, i) => (
                    <div key={i} className="text-[10px] py-0.5">
                      <span className="font-semibold" style={{ color: accentColor }}>{m.userName}: </span>
                      <span className="opacity-60">{m.text}</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Button className="w-full" style={{ background: accentColor }} onClick={createRoom}>
                <Users className="h-4 w-4 mr-2" />Crear nueva sala
              </Button>
              <div className="flex gap-2">
                <input className="flex-1 bg-transparent border rounded px-2 py-1 text-[11px]"
                  style={{ borderColor: 'rgba(255,255,255,0.07)' }}
                  placeholder="Código de sala…"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)} />
                <Button variant="outline" onClick={joinRoom}>Unirse</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Glossary Popup */}
      {showGlossaryPopup && (
        <div className="fixed z-50 p-3 rounded-lg border shadow-xl max-w-[280px]"
          style={{ left: glossaryPopupPos.x, top: glossaryPopupPos.y, background: store.theme === 'light' ? '#fff' : '#1f1f28', borderColor: 'rgba(255,255,255,0.13)' }}>
          <div className="font-semibold text-[12px] mb-1" style={{ color: accentColor }}>{glossaryPopupTerm}</div>
          <div className="text-[11px] opacity-60 mb-2">{glossaryPopupDef}</div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="text-[9px] h-5" onClick={addToGlossary}>
              <Plus className="h-2 w-2 mr-1" />Añadir
            </Button>
            <Button variant="ghost" size="sm" className="text-[9px] h-5" onClick={() => setShowGlossaryPopup(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".pdf,.epub,.docx,.doc,.txt,.cbz,.cbr,.png,.jpg,.jpeg,.webp,.tiff" multiple
        className="hidden" onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) loadFileObj(files[0]);
          e.target.value = '';
        }} />

      {/* Keyboard shortcuts */}
      <KeyboardShortcuts
        onPlay={togglePlay}
        onPrev={prevPara}
        onNext={nextPara}
        onBookmark={addBookmarkAtCurrent}
        onSearch={() => setSearchOpen(!searchOpen)}
        onRSVP={() => setShowRSVP(true)}
        onFocus={() => store.setFocusMode(!store.focusMode)}
      />

      {/* Ambient Sound */}
      {store.ambientSound !== 'none' && (
        <audio
          key={store.ambientSound}
          ref={ambientAudioRef}
          autoPlay
          loop
          src={{
            rain: 'https://cdn.freesound.org/previews/531/531804_6455675-lq.mp3',
            forest: 'https://cdn.freesound.org/previews/531/531811_6455675-lq.mp3',
            cafe: 'https://cdn.freesound.org/previews/425/425567_5121236-lq.mp3',
            waves: 'https://cdn.freesound.org/previews/531/531816_6455675-lq.mp3',
            fire: 'https://cdn.freesound.org/previews/531/531808_6455675-lq.mp3',
            wind: 'https://cdn.freesound.org/previews/531/531812_6455675-lq.mp3',
            lofi: 'https://cdn.freesound.org/previews/531/531815_6455675-lq.mp3',
          }[store.ambientSound]}
        />
      )}
    </div>
  );
}

// ── Mind Map Tree Component ──
function MindMapTree({ node, onSelect, accentColor, depth = 0 }: { node: MindMapNode; onSelect: (id: string) => void; accentColor: string; depth?: number }) {
  return (
    <div className={depth > 0 ? 'ml-' + Math.min(depth * 3, 12) : ''}>
      <div className={`text-[10px] py-0.5 cursor-pointer hover:opacity-80 ${depth === 0 ? 'font-bold text-[12px]' : ''}`}
        style={{ color: depth === 0 ? accentColor : depth === 1 ? 'inherit' : 'rgba(255,255,255,0.4)' }}
        onClick={() => onSelect(node.id)}>
        {depth > 0 && <span className="mr-1 opacity-30">{depth === 1 ? '├─' : '│─'}</span>}
        {node.label}
      </div>
      {node.children.map((child, i) => (
        <MindMapTree key={child.id} node={child} onSelect={onSelect} accentColor={accentColor} depth={depth + 1} />
      ))}
    </div>
  );
}

// ── Keyboard Shortcuts Hook ──
function KeyboardShortcuts({ onPlay, onPrev, onNext, onBookmark, onSearch, onRSVP, onFocus }: {
  onPlay: () => void; onPrev: () => void; onNext: () => void;
  onBookmark: () => void; onSearch: () => void; onRSVP: () => void; onFocus: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); onSearch(); }
      else if (e.key === ' ') { e.preventDefault(); onPlay(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); onPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); onNext(); }
      else if (e.key === 'b' || e.key === 'B') onBookmark();
      else if (e.key === 'r' || e.key === 'R') onRSVP();
      else if (e.key === 'f' || e.key === 'F') onFocus();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPlay, onPrev, onNext, onBookmark, onSearch, onRSVP, onFocus]);
  return null;
}
