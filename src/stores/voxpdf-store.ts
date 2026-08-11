/**
 * VoxPDF v4 — Global Store (Zustand) — Extended with 20 new plugins
 */
import { create } from 'zustand';
import {
  AppSettings, Bookmark, Chapter, DEFAULT_SETTINGS, Flashcard,
  GlossaryTerm, Highlight, MindMapNode, Paragraph, PomodoroState,
  RoomUser, RoomMessage, TranslationConfig, VoiceInfo,
  QuizQuestion, Citation, SentimentResult, SectionSummary, ExtractedTable,
  LanguageDetection, DocComparison, QAMessage, ReadingStats,
  FocusModeType, WebClip, AmbientSound, SubtitleEntry
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

  // ── NEW: Q&A Chat ──
  qaMessages: QAMessage[];
  qaLoading: boolean;

  // ── NEW: Quiz ──
  quizQuestions: QuizQuestion[];
  quizLoading: boolean;
  quizCurrentIdx: number;
  quizScore: number;
  quizAnswered: boolean[];

  // ── NEW: Citations ──
  citations: Citation[];
  citationsLoading: boolean;
  citationFormat: 'apa' | 'mla' | 'chicago';

  // ── NEW: Section Summaries ──
  sectionSummaries: SectionSummary[];
  sectionSummariesLoading: boolean;

  // ── NEW: Sentiment ──
  sentimentResults: SentimentResult[];
  sentimentLoading: boolean;

  // ── NEW: Language Detection ──
  detectedLanguage: LanguageDetection | null;
  languageLoading: boolean;

  // ── NEW: Extracted Tables ──
  extractedTables: ExtractedTable[];
  tablesLoading: boolean;

  // ── NEW: Document Comparison ──
  docComparison: DocComparison | null;
  comparisonLoading: boolean;
  secondDocText: string;
  secondDocName: string;

  // ── NEW: Reading Stats ──
  readingStats: ReadingStats;
  readingSessionStart: number;

  // ── NEW: Focus Mode ──
  focusModeType: FocusModeType;
  focusLineIdx: number;

  // ── NEW: Split View ──
  splitView: boolean;
  splitDocName: string;
  splitDocParagraphs: Paragraph[];
  splitDocCurrentIdx: number;

  // ── NEW: Audio Export ──
  audioExporting: boolean;
  audioExportProgress: number;

  // ── NEW: Podcast Mode ──
  podcastMode: boolean;
  podcastIntro: string;
  podcastOutro: string;

  // ── NEW: Ambient Sound ──
  ambientSound: AmbientSound;
  ambientVolume: number;

  // ── NEW: Subtitles ──
  subtitles: SubtitleEntry[];
  subtitleFormat: 'srt' | 'vtt';
  subtitleVisible: boolean;

  // ── NEW: Web Clips ──
  webClips: WebClip[];
  webClipLoading: boolean;

  // ── NEW: Word Cloud ──
  wordCloudData: { text: string; value: number }[];
  wordCloudLoading: boolean;

  // ── NEW: Timeline ──
  timelineData: { date: string; event: string }[];
  timelineLoading: boolean;

  // ── NEW: Concept Network ──
  conceptNetwork: { nodes: { id: string; label: string }[]; edges: { source: string; target: string; label?: string }[] } | null;
  conceptNetworkLoading: boolean;

  // ── NEW: OCR ──
  ocrActive: boolean;
  ocrProgress: number;
  ocrResult: string;

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

  // ── NEW Actions ──
  setQAMessages: (m: QAMessage[]) => void;
  addQAMessage: (m: QAMessage) => void;
  setQALoading: (v: boolean) => void;

  setQuizQuestions: (q: QuizQuestion[]) => void;
  setQuizLoading: (v: boolean) => void;
  setQuizCurrentIdx: (i: number) => void;
  setQuizScore: (s: number) => void;
  setQuizAnswered: (a: boolean[]) => void;

  setCitations: (c: Citation[]) => void;
  setCitationsLoading: (v: boolean) => void;
  setCitationFormat: (f: 'apa' | 'mla' | 'chicago') => void;

  setSectionSummaries: (s: SectionSummary[]) => void;
  setSectionSummariesLoading: (v: boolean) => void;

  setSentimentResults: (r: SentimentResult[]) => void;
  setSentimentLoading: (v: boolean) => void;

  setDetectedLanguage: (l: LanguageDetection | null) => void;
  setLanguageLoading: (v: boolean) => void;

  setExtractedTables: (t: ExtractedTable[]) => void;
  setTablesLoading: (v: boolean) => void;

  setDocComparison: (c: DocComparison | null) => void;
  setComparisonLoading: (v: boolean) => void;
  setSecondDocText: (t: string) => void;
  setSecondDocName: (n: string) => void;

  setReadingStats: (s: ReadingStats) => void;
  setReadingSessionStart: (t: number) => void;

  setFocusModeType: (f: FocusModeType) => void;
  setFocusLineIdx: (i: number) => void;

  setSplitView: (v: boolean) => void;
  setSplitDocName: (n: string) => void;
  setSplitDocParagraphs: (p: Paragraph[]) => void;
  setSplitDocCurrentIdx: (i: number) => void;

  setAudioExporting: (v: boolean) => void;
  setAudioExportProgress: (p: number) => void;

  setPodcastMode: (v: boolean) => void;
  setPodcastIntro: (s: string) => void;
  setPodcastOutro: (s: string) => void;

  setAmbientSound: (s: AmbientSound) => void;
  setAmbientVolume: (v: number) => void;

  setSubtitles: (s: SubtitleEntry[]) => void;
  setSubtitleFormat: (f: 'srt' | 'vtt') => void;
  setSubtitleVisible: (v: boolean) => void;

  setWebClips: (c: WebClip[]) => void;
  addWebClip: (c: WebClip) => void;
  setWebClipLoading: (v: boolean) => void;

  setWordCloudData: (d: { text: string; value: number }[]) => void;
  setWordCloudLoading: (v: boolean) => void;

  setTimelineData: (d: { date: string; event: string }[]) => void;
  setTimelineLoading: (v: boolean) => void;

  setConceptNetwork: (n: { nodes: { id: string; label: string }[]; edges: { source: string; target: string; label?: string }[] } | null) => void;
  setConceptNetworkLoading: (v: boolean) => void;

  setOcrActive: (v: boolean) => void;
  setOcrProgress: (p: number) => void;
  setOcrResult: (r: string) => void;
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

  // ── NEW: Q&A Chat ──
  qaMessages: [],
  qaLoading: false,

  // ── NEW: Quiz ──
  quizQuestions: [],
  quizLoading: false,
  quizCurrentIdx: 0,
  quizScore: 0,
  quizAnswered: [],

  // ── NEW: Citations ──
  citations: [],
  citationsLoading: false,
  citationFormat: 'apa',

  // ── NEW: Section Summaries ──
  sectionSummaries: [],
  sectionSummariesLoading: false,

  // ── NEW: Sentiment ──
  sentimentResults: [],
  sentimentLoading: false,

  // ── NEW: Language Detection ──
  detectedLanguage: null,
  languageLoading: false,

  // ── NEW: Extracted Tables ──
  extractedTables: [],
  tablesLoading: false,

  // ── NEW: Document Comparison ──
  docComparison: null,
  comparisonLoading: false,
  secondDocText: '',
  secondDocName: '',

  // ── NEW: Reading Stats ──
  readingStats: { totalPagesRead: 0, totalMinutesRead: 0, averageWPM: 0, sessionsCount: 0, dailyProgress: [], streak: 0 },
  readingSessionStart: 0,

  // ── NEW: Focus Mode ──
  focusModeType: 'off',
  focusLineIdx: 0,

  // ── NEW: Split View ──
  splitView: false,
  splitDocName: '',
  splitDocParagraphs: [],
  splitDocCurrentIdx: 0,

  // ── NEW: Audio Export ──
  audioExporting: false,
  audioExportProgress: 0,

  // ── NEW: Podcast Mode ──
  podcastMode: false,
  podcastIntro: '',
  podcastOutro: '',

  // ── NEW: Ambient Sound ──
  ambientSound: 'none',
  ambientVolume: 0.5,

  // ── NEW: Subtitles ──
  subtitles: [],
  subtitleFormat: 'srt',
  subtitleVisible: false,

  // ── NEW: Web Clips ──
  webClips: [],
  webClipLoading: false,

  // ── NEW: Word Cloud ──
  wordCloudData: [],
  wordCloudLoading: false,

  // ── NEW: Timeline ──
  timelineData: [],
  timelineLoading: false,

  // ── NEW: Concept Network ──
  conceptNetwork: null,
  conceptNetworkLoading: false,

  // ── NEW: OCR ──
  ocrActive: false,
  ocrProgress: 0,
  ocrResult: '',

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

  // ── NEW Actions ──
  setQAMessages: (m) => set({ qaMessages: m }),
  addQAMessage: (m) => set((s) => ({ qaMessages: [...s.qaMessages, m] })),
  setQALoading: (v) => set({ qaLoading: v }),

  setQuizQuestions: (q) => set({ quizQuestions: q, quizAnswered: q.map(() => false) }),
  setQuizLoading: (v) => set({ quizLoading: v }),
  setQuizCurrentIdx: (i) => set({ quizCurrentIdx: i }),
  setQuizScore: (s) => set({ quizScore: s }),
  setQuizAnswered: (a) => set({ quizAnswered: a }),

  setCitations: (c) => set({ citations: c }),
  setCitationsLoading: (v) => set({ citationsLoading: v }),
  setCitationFormat: (f) => set({ citationFormat: f }),

  setSectionSummaries: (s) => set({ sectionSummaries: s }),
  setSectionSummariesLoading: (v) => set({ sectionSummariesLoading: v }),

  setSentimentResults: (r) => set({ sentimentResults: r }),
  setSentimentLoading: (v) => set({ sentimentLoading: v }),

  setDetectedLanguage: (l) => set({ detectedLanguage: l }),
  setLanguageLoading: (v) => set({ languageLoading: v }),

  setExtractedTables: (t) => set({ extractedTables: t }),
  setTablesLoading: (v) => set({ tablesLoading: v }),

  setDocComparison: (c) => set({ docComparison: c }),
  setComparisonLoading: (v) => set({ comparisonLoading: v }),
  setSecondDocText: (t) => set({ secondDocText: t }),
  setSecondDocName: (n) => set({ secondDocName: n }),

  setReadingStats: (s) => set({ readingStats: s }),
  setReadingSessionStart: (t) => set({ readingSessionStart: t }),

  setFocusModeType: (f) => set({ focusModeType: f }),
  setFocusLineIdx: (i) => set({ focusLineIdx: i }),

  setSplitView: (v) => set({ splitView: v }),
  setSplitDocName: (n) => set({ splitDocName: n }),
  setSplitDocParagraphs: (p) => set({ splitDocParagraphs: p }),
  setSplitDocCurrentIdx: (i) => set({ splitDocCurrentIdx: i }),

  setAudioExporting: (v) => set({ audioExporting: v }),
  setAudioExportProgress: (p) => set({ audioExportProgress: p }),

  setPodcastMode: (v) => set({ podcastMode: v }),
  setPodcastIntro: (s) => set({ podcastIntro: s }),
  setPodcastOutro: (s) => set({ podcastOutro: s }),

  setAmbientSound: (s) => set({ ambientSound: s }),
  setAmbientVolume: (v) => set({ ambientVolume: v }),

  setSubtitles: (s) => set({ subtitles: s }),
  setSubtitleFormat: (f) => set({ subtitleFormat: f }),
  setSubtitleVisible: (v) => set({ subtitleVisible: v }),

  setWebClips: (c) => set({ webClips: c }),
  addWebClip: (c) => set((s) => ({ webClips: [...s.webClips, c] })),
  setWebClipLoading: (v) => set({ webClipLoading: v }),

  setWordCloudData: (d) => set({ wordCloudData: d }),
  setWordCloudLoading: (v) => set({ wordCloudLoading: v }),

  setTimelineData: (d) => set({ timelineData: d }),
  setTimelineLoading: (v) => set({ timelineLoading: v }),

  setConceptNetwork: (n) => set({ conceptNetwork: n }),
  setConceptNetworkLoading: (v) => set({ conceptNetworkLoading: v }),

  setOcrActive: (v) => set({ ocrActive: v }),
  setOcrProgress: (p) => set({ ocrProgress: p }),
  setOcrResult: (r) => set({ ocrResult: r }),
}));
