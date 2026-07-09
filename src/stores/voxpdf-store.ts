/**
 * VoxPDF v4 — Global Store (Zustand)
 */
import { create } from 'zustand';
import {
  AppSettings, Bookmark, Chapter, DEFAULT_SETTINGS, Flashcard,
  GlossaryTerm, Highlight, MindMapNode, Paragraph, PomodoroState,
  RoomUser, RoomMessage, TranslationConfig, VoiceInfo
} from '@/lib/voxpdf-types';

interface VoxPDFStore {
  // ── Document ──
  fileName: string;
  paragraphs: Paragraph[];
  chapters: Chapter[];
  bookmarks: Bookmark[];
  highlights: Highlight[];
  currentParaIdx: number;
  pageProgress: number;
  totalPages: number;

  // ── TTS ──
  playing: boolean;
  voices: VoiceInfo[];
  selectedVoice: number;
  rate: number;
  pitch: number;
  volume: number;
  pauseOnPunctuation: boolean;
  preSynthesisLookahead: boolean;
  autoLanguageSwitch: boolean;
  eqBands: number[];
  eqPresetName: string;
  ttsEstimatedTime: number;

  // ── Settings ──
  settings: AppSettings;
  theme: string;
  fontSize: number;
  fontFamily: string;
  focusMode: boolean;
  invertMode: boolean;
  skipHF: boolean;
  highlightWords: boolean;
  teleprompterMode: boolean;
  parallelView: boolean;
  einkOptimized: boolean;
  lazyRendering: boolean;

  // ── Translation ──
  translation: TranslationConfig;
  translationCache: Record<string, string>;

  // ── Glossary ──
  glossary: GlossaryTerm[];

  // ── Mind Map ──
  mindMap: MindMapNode | null;

  // ── Flashcards ──
  flashcards: Flashcard[];

  // ── Heat Map ──
  wordFrequency: Record<string, number>;

  // ── Pomodoro ──
  pomodoro: PomodoroState;

  // ── Sleep Timer ──
  sleepTimerMinutes: number;
  sleepTimerRemaining: number;

  // ── Cloud Sync ──
  isLoggedIn: boolean;
  userName: string;
  userEmail: string;
  lastSyncTime: number;

  // ── Reading Room ──
  roomId: string;
  roomUsers: RoomUser[];
  roomMessages: RoomMessage[];

  // ── Voice Control ──
  voiceControlActive: boolean;

  // ── Mini-map ──
  miniMapBookmarks: number[];

  // ── Sidebar ──
  sidebarOpen: boolean;
  sidebarTab: string;

  // ── Search ──
  searchQuery: string;
  searchHits: number[];
  searchCurrentIdx: number;

  // ── Actions ──
  setFileName: (name: string) => void;
  setParagraphs: (paras: Paragraph[]) => void;
  setChapters: (ch: Chapter[]) => void;
  addBookmark: (bm: Bookmark) => void;
  removeBookmark: (idx: number) => void;
  addHighlight: (hl: Highlight) => void;
  setCurrentParaIdx: (idx: number) => void;
  setPageProgress: (pct: number) => void;
  setTotalPages: (n: number) => void;

  setPlaying: (p: boolean) => void;
  setVoices: (v: VoiceInfo[]) => void;
  setSelectedVoice: (i: number) => void;
  setRate: (r: number) => void;
  setPitch: (p: number) => void;
  setVolume: (v: number) => void;
  setPauseOnPunctuation: (v: boolean) => void;
  setPreSynthesisLookahead: (v: boolean) => void;
  setAutoLanguageSwitch: (v: boolean) => void;
  setEqBands: (bands: number[]) => void;
  setEqPresetName: (name: string) => void;

  setTheme: (t: string) => void;
  setFontSize: (s: number) => void;
  setFontFamily: (f: string) => void;
  setFocusMode: (v: boolean) => void;
  setInvertMode: (v: boolean) => void;
  setSkipHF: (v: boolean) => void;
  setHighlightWords: (v: boolean) => void;
  setTeleprompterMode: (v: boolean) => void;
  setParallelView: (v: boolean) => void;
  setEinkOptimized: (v: boolean) => void;
  setLazyRendering: (v: boolean) => void;
  setSettings: (s: Partial<AppSettings>) => void;

  setTranslation: (t: Partial<TranslationConfig>) => void;
  setTranslationCache: (k: string, v: string) => void;

  addGlossaryTerm: (t: GlossaryTerm) => void;
  removeGlossaryTerm: (term: string) => void;

  setMindMap: (m: MindMapNode | null) => void;

  addFlashcard: (f: Flashcard) => void;
  removeFlashcard: (idx: number) => void;
  setFlashcards: (f: Flashcard[]) => void;

  setWordFrequency: (wf: Record<string, number>) => void;

  setPomodoro: (p: Partial<PomodoroState>) => void;

  setSleepTimerMinutes: (m: number) => void;
  setSleepTimerRemaining: (s: number) => void;

  setLoggedIn: (v: boolean, name?: string, email?: string) => void;
  setLastSyncTime: (t: number) => void;

  setRoomId: (id: string) => void;
  setRoomUsers: (u: RoomUser[]) => void;
  addRoomMessage: (m: RoomMessage) => void;

  setVoiceControlActive: (v: boolean) => void;

  setMiniMapBookmarks: (b: number[]) => void;

  setSidebarOpen: (v: boolean) => void;
  setSidebarTab: (t: string) => void;

  setSearchQuery: (q: string) => void;
  setSearchHits: (h: number[]) => void;
  setSearchCurrentIdx: (i: number) => void;
}

export const useVoxPDFStore = create<VoxPDFStore>((set, get) => ({
  // ── Document ──
  fileName: '',
  paragraphs: [],
  chapters: [],
  bookmarks: [],
  highlights: [],
  currentParaIdx: 0,
  pageProgress: 0,
  totalPages: 0,

  // ── TTS ──
  playing: false,
  voices: [],
  selectedVoice: 0,
  rate: 1,
  pitch: 1,
  volume: 1,
  pauseOnPunctuation: true,
  preSynthesisLookahead: true,
  autoLanguageSwitch: false,
  eqBands: [0, 0, 0, 0, 0],
  eqPresetName: 'Plano',
  ttsEstimatedTime: 0,

  // ── Settings ──
  settings: DEFAULT_SETTINGS,
  theme: 'dark',
  fontSize: 15,
  fontFamily: 'mono',
  focusMode: false,
  invertMode: false,
  skipHF: false,
  highlightWords: true,
  teleprompterMode: false,
  parallelView: false,
  einkOptimized: false,
  lazyRendering: true,

  // ── Translation ──
  translation: DEFAULT_SETTINGS.translation,
  translationCache: {},

  // ── Glossary ──
  glossary: [],

  // ── Mind Map ──
  mindMap: null,

  // ── Flashcards ──
  flashcards: [],

  // ── Heat Map ──
  wordFrequency: {},

  // ── Pomodoro ──
  pomodoro: { mode: 'idle', timeLeft: 25 * 60, workDuration: 25, breakDuration: 5, sessions: 0 },

  // ── Sleep Timer ──
  sleepTimerMinutes: 0,
  sleepTimerRemaining: 0,

  // ── Cloud Sync ──
  isLoggedIn: false,
  userName: '',
  userEmail: '',
  lastSyncTime: 0,

  // ── Reading Room ──
  roomId: '',
  roomUsers: [],
  roomMessages: [],

  // ── Voice Control ──
  voiceControlActive: false,

  // ── Mini-map ──
  miniMapBookmarks: [],

  // ── Sidebar ──
  sidebarOpen: true,
  sidebarTab: 'recents',

  // ── Search ──
  searchQuery: '',
  searchHits: [],
  searchCurrentIdx: 0,

  // ── Actions ──
  setFileName: (name) => set({ fileName: name }),
  setParagraphs: (paras) => set({ paragraphs: paras }),
  setChapters: (ch) => set({ chapters: ch }),
  addBookmark: (bm) => set((s) => ({ bookmarks: [...s.bookmarks, bm] })),
  removeBookmark: (idx) => set((s) => ({ bookmarks: s.bookmarks.filter((_, i) => i !== idx) })),
  addHighlight: (hl) => set((s) => ({ highlights: [...s.highlights, hl] })),
  setCurrentParaIdx: (idx) => set((s) => ({ currentParaIdx: idx, pageProgress: s.paragraphs.length ? idx / s.paragraphs.length : 0 })),
  setPageProgress: (pct) => set({ pageProgress: pct }),
  setTotalPages: (n) => set({ totalPages: n }),

  setPlaying: (p) => set({ playing: p }),
  setVoices: (v) => set({ voices: v }),
  setSelectedVoice: (i) => set({ selectedVoice: i }),
  setRate: (r) => set({ rate: r }),
  setPitch: (p) => set({ pitch: p }),
  setVolume: (v) => set({ volume: v }),
  setPauseOnPunctuation: (v) => set({ pauseOnPunctuation: v }),
  setPreSynthesisLookahead: (v) => set({ preSynthesisLookahead: v }),
  setAutoLanguageSwitch: (v) => set({ autoLanguageSwitch: v }),
  setEqBands: (bands) => set({ eqBands: bands }),
  setEqPresetName: (name) => set({ eqPresetName: name }),

  setTheme: (t) => set({ theme: t }),
  setFontSize: (s) => set({ fontSize: s }),
  setFontFamily: (f) => set({ fontFamily: f }),
  setFocusMode: (v) => set({ focusMode: v }),
  setInvertMode: (v) => set({ invertMode: v }),
  setSkipHF: (v) => set({ skipHF: v }),
  setHighlightWords: (v) => set({ highlightWords: v }),
  setTeleprompterMode: (v) => set({ teleprompterMode: v }),
  setParallelView: (v) => set({ parallelView: v }),
  setEinkOptimized: (v) => set({ einkOptimized: v }),
  setLazyRendering: (v) => set({ lazyRendering: v }),
  setSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),

  setTranslation: (t) => set((s) => ({ translation: { ...s.translation, ...t } })),
  setTranslationCache: (k, v) => set((s) => ({ translationCache: { ...s.translationCache, [k]: v } })),

  addGlossaryTerm: (t) => set((s) => ({ glossary: [...s.glossary, t] })),
  removeGlossaryTerm: (term) => set((s) => ({ glossary: s.glossary.filter(g => g.term !== term) })),

  setMindMap: (m) => set({ mindMap: m }),

  addFlashcard: (f) => set((s) => ({ flashcards: [...s.flashcards, f] })),
  removeFlashcard: (idx) => set((s) => ({ flashcards: s.flashcards.filter((_, i) => i !== idx) })),
  setFlashcards: (f) => set({ flashcards: f }),

  setWordFrequency: (wf) => set({ wordFrequency: wf }),

  setPomodoro: (p) => set((s) => ({ pomodoro: { ...s.pomodoro, ...p } })),

  setSleepTimerMinutes: (m) => set({ sleepTimerMinutes: m, sleepTimerRemaining: m * 60 }),
  setSleepTimerRemaining: (s) => set({ sleepTimerRemaining: s }),

  setLoggedIn: (v, name, email) => set({ isLoggedIn: v, userName: name || '', userEmail: email || '' }),
  setLastSyncTime: (t) => set({ lastSyncTime: t }),

  setRoomId: (id) => set({ roomId: id }),
  setRoomUsers: (u) => set({ roomUsers: u }),
  addRoomMessage: (m) => set((s) => ({ roomMessages: [...s.roomMessages, m] })),

  setVoiceControlActive: (v) => set({ voiceControlActive: v }),

  setMiniMapBookmarks: (b) => set({ miniMapBookmarks: b }),

  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setSidebarTab: (t) => set({ sidebarTab: t }),

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchHits: (h) => set({ searchHits: h }),
  setSearchCurrentIdx: (i) => set({ searchCurrentIdx: i }),
}));
