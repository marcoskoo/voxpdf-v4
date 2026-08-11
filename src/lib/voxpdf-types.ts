/**
 * VoxPDF v4 — Core Types
 * Lector con Voz + GLM AI — 26 features
 */

// ── AI Engine ──
export const AI_ENGINE = 'GLM' as const;
export const AI_MODEL = 'glm-4-flash' as const;

// ── Document ──
export interface Paragraph {
  text: string;
  page: number;
  isHeader: boolean;
  isFooter: boolean;
  element?: HTMLElement;
  wordElements?: HTMLElement[];
  wordOffsets?: number[];
  sentenceElements?: HTMLElement[];
  sentenceOffsets?: number[];
}

export interface Chapter {
  title: string;
  startIdx: number;
  page: number;
}

export interface Bookmark {
  paraIdx: number;
  note: string;
  text: string;
  date: number;
}

export interface Highlight {
  paraIdx: number;
  color: string;
  date: number;
}

export interface DocumentFile {
  name: string;
  type: 'pdf' | 'epub' | 'docx' | 'txt' | 'cbz' | 'cbr' | 'image';
  data: ArrayBuffer;
  pageCount?: number;
}

// ── TTS ──
export interface TTSConfig {
  rate: number;
  pitch: number;
  volume: number;
  voiceIdx: number;
  pauseOnPunctuation: boolean;
  preSynthesisLookahead: boolean;
  autoLanguageSwitch: boolean;
  equalizerBands: number[];
}

export interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  lang: string;
  name: string;
}

// ── Audio Equalizer ──
export interface EqualizerPreset {
  name: string;
  bands: number[]; // 5 bands: 60Hz, 230Hz, 910Hz, 4kHz, 14kHz
}

// ── Flashcards / Anki ──
export interface Flashcard {
  front: string;
  back: string;
  tags: string[];
  deck: string;
}

// ── Translation ──
export interface TranslationConfig {
  sourceLang: string;
  targetLang: string;
  showParallel: boolean;
}

// ── Glossary ──
export interface GlossaryTerm {
  term: string;
  definition: string;
  source: string;
}

// ── Mind Map ──
export interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
  depth: number;
}

// ── Cloud Sync ──
export interface SyncData {
  bookmarks: Record<string, Bookmark[]>;
  highlights: Record<string, Highlight[]>;
  progress: Record<string, { idx: number; ts: number }>;
  glossary: GlossaryTerm[];
  settings: Partial<AppSettings>;
}

// ── Pomodoro ──
export interface PomodoroState {
  mode: 'work' | 'break' | 'idle';
  timeLeft: number;
  workDuration: number;
  breakDuration: number;
  sessions: number;
}

// ── Reading Room ──
export interface RoomUser {
  id: string;
  name: string;
  color: string;
  currentParaIdx: number;
  lastActive: number;
}

export interface RoomMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

// ── App Settings ──
export interface AppSettings {
  theme: 'dark' | 'light' | 'sepia' | 'contrast' | 'ocean' | 'eink';
  fontSize: number;
  fontFamily: 'mono' | 'sans' | 'serif';
  focusMode: boolean;
  invertMode: boolean;
  skipHeadersFooters: boolean;
  highlightWords: boolean;
  tts: TTSConfig;
  translation: TranslationConfig;
  pomodoro: { workDuration: number; breakDuration: number };
  sleepTimer: number; // minutes, 0 = off
  teleprompterMode: boolean;
  parallelView: boolean;
  einkOptimized: boolean;
  lazyRendering: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 15,
  fontFamily: 'mono',
  focusMode: false,
  invertMode: false,
  skipHeadersFooters: false,
  highlightWords: true,
  tts: {
    rate: 1,
    pitch: 1,
    volume: 1,
    voiceIdx: 0,
    pauseOnPunctuation: true,
    preSynthesisLookahead: true,
    autoLanguageSwitch: false,
    equalizerBands: [0, 0, 0, 0, 0],
  },
  translation: {
    sourceLang: 'auto',
    targetLang: 'es',
    showParallel: true,
  },
  pomodoro: { workDuration: 25, breakDuration: 5 },
  sleepTimer: 0,
  teleprompterMode: false,
  parallelView: false,
  einkOptimized: false,
  lazyRendering: true,
};

// ── Equalizer Presets ──
export const EQ_PRESETS: EqualizerPreset[] = [
  { name: 'Plano', bands: [0, 0, 0, 0, 0] },
  { name: 'Voz clara', bands: [2, 4, 6, 3, 1] },
  { name: 'Bass boost', bands: [6, 4, 0, -1, -2] },
  { name: 'Treble boost', bands: [-2, -1, 0, 3, 6] },
  { name: 'Podcast', bands: [-1, 2, 5, 3, 0] },
  { name: 'Audiobook', bands: [1, 3, 5, 2, -1] },
];

// ── Heat Map Colors ──
export const HEAT_COLORS = [
  'rgba(124,106,245,0.05)',
  'rgba(124,106,245,0.12)',
  'rgba(124,106,245,0.20)',
  'rgba(124,106,245,0.30)',
  'rgba(124,106,245,0.45)',
  'rgba(255,107,53,0.30)',
  'rgba(255,107,53,0.50)',
];

// ── NEW: Quiz ──
export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

// ── NEW: Citation ──
export interface Citation {
  original: string;
  apa: string;
  mla: string;
  chicago: string;
  type: string;
}

// ── NEW: Sentiment ──
export interface SentimentResult {
  title: string;
  sentiment: string;
  score: number;
}

// ── NEW: Section Summary ──
export interface SectionSummary {
  title: string;
  summary: string;
}

// ── NEW: Extracted Table ──
export interface ExtractedTable {
  headers: string[];
  rows: string[][];
  caption: string;
}

// ── NEW: Language Detection ──
export interface LanguageDetection {
  language: string;
  code: string;
  confidence: number;
}

// ── NEW: Document Comparison ──
export interface DocComparison {
  similarities: string[];
  differences: string[];
  summary: string;
}

// ── NEW: Q&A Message ──
export interface QAMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── NEW: Reading Stats ──
export interface ReadingStats {
  totalPagesRead: number;
  totalMinutesRead: number;
  averageWPM: number;
  sessionsCount: number;
  dailyProgress: { date: string; pages: number; minutes: number }[];
  streak: number;
}

// ── NEW: Focus Mode Type ──
export type FocusModeType = 'off' | 'lineByLine' | 'narrowColumn' | 'distractionFree';

// ── NEW: Audio Export Format ──
export type AudioExportFormat = 'mp3' | 'm4b' | 'wav' | 'ogg';

// ── NEW: Subtitle Format ──
export interface SubtitleEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

// ── NEW: Web Clip ──
export interface WebClip {
  title: string;
  content: string;
  summary: string;
  url: string;
  clippedAt: number;
}

// ── NEW: Ambient Sound ──
export type AmbientSound = 'none' | 'rain' | 'forest' | 'cafe' | 'waves' | 'fire' | 'wind' | 'lofi';
