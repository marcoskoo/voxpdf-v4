/**
 * GLM API Helper for VoxPDF v4
 * Works both locally (z-ai-web-dev-sdk reads .z-ai-config) and on Vercel (uses env vars).
 *
 * In Vercel, set these environment variables:
 *   ZAI_BASE_URL=https://internal-api.z.ai/v1
 *   ZAI_API_KEY=Z.ai
 *   ZAI_CHAT_ID=chat-xxxx
 *   ZAI_USER_ID=xxxx
 *   ZAI_TOKEN=eyJhbGci...
 */

import type { ChatMessage } from 'z-ai-web-dev-sdk';

let _zaiInstance: any = null;

async function getZAI() {
  if (_zaiInstance) return _zaiInstance;

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    _zaiInstance = await ZAI.create();
    return _zaiInstance;
  } catch (sdkError) {
    // SDK failed (likely no .z-ai-config file, e.g. on Vercel)
    // Fall back to direct fetch using environment variables
    console.log('z-ai-web-dev-sdk init failed, using env var fallback');
    _zaiInstance = createEnvVarClient();
    return _zaiInstance;
  }
}

function createEnvVarClient() {
  const baseUrl = process.env.ZAI_BASE_URL || 'https://internal-api.z.ai/v1';
  const apiKey = process.env.ZAI_API_KEY || 'Z.ai';
  const chatId = process.env.ZAI_CHAT_ID || '';
  const userId = process.env.ZAI_USER_ID || '';
  const token = process.env.ZAI_TOKEN || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'X-Z-AI-From': 'Z',
  };
  if (chatId) headers['X-Chat-Id'] = chatId;
  if (userId) headers['X-User-Id'] = userId;
  if (token) headers['X-Token'] = token;

  return {
    chat: {
      completions: {
        create: async (body: { messages: ChatMessage[]; model?: string; stream?: boolean; thinking?: any }) => {
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...body,
              thinking: body.thinking || { type: 'disabled' },
            }),
          });
          if (!response.ok) {
            throw new Error(`GLM API error: ${response.status} ${await response.text()}`);
          }
          return response.json();
        },
      },
    },
    audio: {
      tts: {
        create: async (body: any) => {
          const response = await fetch(`${baseUrl}/audio/tts`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });
          return response.json();
        },
      },
      asr: {
        create: async (body: any) => {
          const response = await fetch(`${baseUrl}/audio/asr`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });
          return response.json();
        },
      },
    },
  };
}

export async function glmTranslate(text: string, source: string, target: string): Promise<string> {
  const zai = await getZAI();
  const sourceLabel = source === 'auto' ? 'the original language' : source;
  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: `You are a professional translator. Translate the given text from ${sourceLabel} to ${target}. Return ONLY the translation, nothing else. Preserve formatting and structure.` },
      { role: 'user', content: text },
    ],
    stream: false,
  });
  return result?.choices?.[0]?.message?.content || result?.content || '';
}

export async function glmDefine(term: string, context: string): Promise<string> {
  const zai = await getZAI();
  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: 'You are a dictionary/glossary assistant. Given a term and optional context, provide a concise definition in the same language as the term. Return ONLY the definition, nothing else. Keep it to 1-2 sentences maximum.' },
      { role: 'user', content: context ? `Term: "${term}"\nContext: "${context}"\n\nDefine this term based on the context.` : `Define: "${term}"` },
    ],
    stream: false,
  });
  return result?.choices?.[0]?.message?.content || result?.content || '';
}

export async function glmFlashcards(paragraphs: any[], chapters: any[], fileName: string): Promise<any[]> {
  const zai = await getZAI();
  const chapterTexts = (chapters || []).map((ch: any, i: number) => {
    const start = ch.startIdx;
    const end = i < chapters.length - 1 ? chapters[i + 1].startIdx : Math.min(start + 5, paragraphs.length);
    const texts = paragraphs.slice(start, Math.min(start + 3, end)).map((p: any) => p.text).join(' ');
    return `Chapter: ${ch.title}\nContent: ${texts}`;
  });
  const docSummary = chapterTexts.length > 0
    ? chapterTexts.slice(0, 20).join('\n\n')
    : paragraphs.slice(0, 20).map((p: any) => p.text).join('\n');

  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: 'You are a study assistant. Generate flashcards from the given document content. Each flashcard should have a question/concept on the front and a clear, concise answer on the back. Return ONLY a JSON array of objects with "front", "back", "tags" (array of strings), and "deck" (string) fields. No other text. Generate between 5 and 20 flashcards covering the key concepts.' },
      { role: 'user', content: `Document: "${fileName}"\n\n${docSummary}` },
    ],
    stream: false,
  });

  const raw = result?.choices?.[0]?.message?.content || result?.content || '[]';
  try {
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return [{ front: 'Resumen del documento', back: raw.slice(0, 200), tags: [fileName || 'document'], deck: (fileName || 'document').replace(/\.\w+$/, '') }];
  }
}

export async function glmMindMap(paragraphs: any[], chapters: any[], fileName: string): Promise<any> {
  const zai = await getZAI();
  const chapterTexts = (chapters || []).map((ch: any, i: number) => {
    const start = ch.startIdx;
    const end = i < chapters.length - 1 ? chapters[i + 1].startIdx : Math.min(start + 3, paragraphs.length);
    const texts = paragraphs.slice(start, Math.min(start + 2, end)).map((p: any) => p.text).join(' ');
    return `Chapter: ${ch.title} — ${texts.slice(0, 200)}`;
  });
  const docContent = chapterTexts.length > 0
    ? chapterTexts.slice(0, 25).join('\n')
    : paragraphs.slice(0, 25).map((p: any) => p.text.slice(0, 100)).join('\n');

  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: 'You are a concept mapping assistant. Generate a mind map / concept tree from the given document content. Return ONLY a JSON object with this structure: { "id": "root", "label": "Document Title", "children": [{ "id": "ch-0", "label": "Chapter/Concept", "children": [{ "id": "ch-0-s0", "label": "Sub-concept", "children": [] }] }] }. Maximum 3 levels deep. Each node needs "id", "label", "children" fields. No other text outside the JSON.' },
      { role: 'user', content: `Document: "${fileName}"\n\n${docContent}` },
    ],
    stream: false,
  });

  const raw = result?.choices?.[0]?.message?.content || result?.content || '{}';
  try {
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    // Fallback: create basic tree from chapters
    return {
      id: 'root',
      label: fileName || 'Documento',
      children: (chapters || []).slice(0, 15).map((ch: any, i: number) => ({
        id: `ch-${i}`,
        label: ch.title,
        children: [],
      })),
    };
  }
}

export async function glmSummarize(text: string, mode: 'brief' | 'detailed' | 'bullet' | 'academic' = 'brief'): Promise<string> {
  const zai = await getZAI();
  const promptMap: Record<string, string> = {
    brief: 'Provide a brief 2-3 sentence summary.',
    detailed: 'Provide a detailed summary covering all main points, key arguments, and conclusions. Use 5-8 sentences.',
    bullet: 'Provide a bullet-point summary with the key takeaways. Use • for each point.',
    academic: 'Provide an academic-style abstract summary in one paragraph.',
  };
  const instruction = promptMap[mode] || promptMap.brief;
  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: `You are a document summarization assistant. ${instruction} Return ONLY the summary, nothing else. Write in the same language as the original text.` },
      { role: 'user', content: text.slice(0, 8000) },
    ],
    stream: false,
  });
  return (result?.choices?.[0]?.message?.content || result?.content || '').trim();
}

export { getZAI };

// ── Q&A Chat with Document ──
export async function glmQA(question: string, context: string, history: ChatMessage[] = []): Promise<string> {
  const zai = await getZAI();
  const systemPrompt = `You are an intelligent document assistant. Answer questions based ONLY on the provided document context. If the answer is not in the document, say so clearly. Be concise but thorough. Cite specific sections when possible. Write in the same language as the question.`;
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),
    { role: 'user', content: `Document context:\n${context.slice(0, 6000)}\n\nQuestion: ${question}` },
  ];
  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages,
    stream: false,
  });
  return result?.choices?.[0]?.message?.content || result?.content || '';
}

// ── Quiz Generation ──
export async function glmQuiz(paragraphs: any[], chapters: any[], fileName: string): Promise<any[]> {
  const zai = await getZAI();
  const docContent = paragraphs.slice(0, 30).map((p: any) => p.text).join('\n');
  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: 'You are a quiz generator. Create multiple-choice questions from the given document. Return ONLY a JSON array of objects with: "question" (string), "options" (array of 4 strings), "correct" (index of correct option, 0-3), "explanation" (string). Generate 5-10 questions covering key concepts. No other text.' },
      { role: 'user', content: `Document: "${fileName}"\n\n${docContent}` },
    ],
    stream: false,
  });
  const raw = result?.choices?.[0]?.message?.content || result?.content || '[]';
  try {
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch { return []; }
}

// ── Citations Auto-detect ──
export async function glmCitations(text: string): Promise<any[]> {
  const zai = await getZAI();
  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: 'You are a citation detection and formatting assistant. Find all citations/references in the text. Return ONLY a JSON array of objects: { "original" (the original citation text), "apa" (APA format), "mla" (MLA format), "chicago" (Chicago format), "type" (book/journal/web/other) }. If no citations found, return empty array. No other text.' },
      { role: 'user', content: text.slice(0, 4000) },
    ],
    stream: false,
  });
  const raw = result?.choices?.[0]?.message?.content || result?.content || '[]';
  try {
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch { return []; }
}

// ── Section Summary ──
export async function glmSectionSummary(sections: { title: string; content: string }[]): Promise<{ title: string; summary: string }[]> {
  const zai = await getZAI();
  const summaries: { title: string; summary: string }[] = [];
  for (const section of sections.slice(0, 20)) {
    try {
      const result = await zai.chat.completions.create({
        model: 'glm-4-flash',
        messages: [
          { role: 'system', content: 'Summarize this section in 2-3 sentences. Write in the same language as the text. Return ONLY the summary.' },
          { role: 'user', content: `Section: ${section.title}\n\n${section.content.slice(0, 2000)}` },
        ],
        stream: false,
      });
      summaries.push({
        title: section.title,
        summary: (result?.choices?.[0]?.message?.content || result?.content || '').trim(),
      });
    } catch {
      summaries.push({ title: section.title, summary: 'Error generating summary' });
    }
  }
  return summaries;
}

// ── Sentiment Analysis ──
export async function glmSentiment(sections: { title: string; content: string }[]): Promise<{ title: string; sentiment: string; score: number }[]> {
  const zai = await getZAI();
  const results: { title: string; sentiment: string; score: number }[] = [];
  for (const section of sections.slice(0, 15)) {
    try {
      const result = await zai.chat.completions.create({
        model: 'glm-4-flash',
        messages: [
          { role: 'system', content: 'Analyze the sentiment/emotional tone of the text. Return ONLY a JSON object: { "sentiment": "positive"|"negative"|"neutral"|"mixed", "score": -1 to 1 }. No other text.' },
          { role: 'user', content: section.content.slice(0, 1500) },
        ],
        stream: false,
      });
      const raw = (result?.choices?.[0]?.message?.content || result?.content || '{}').trim();
      const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
      results.push({ title: section.title, sentiment: parsed.sentiment || 'neutral', score: parsed.score || 0 });
    } catch {
      results.push({ title: section.title, sentiment: 'neutral', score: 0 });
    }
  }
  return results;
}

// ── Language Detection ──
export async function glmDetectLanguage(text: string): Promise<{ language: string; code: string; confidence: number }> {
  const zai = await getZAI();
  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: 'Detect the language of the text. Return ONLY a JSON object: { "language": "full name", "code": "ISO 639-1 code", "confidence": 0-1 }. No other text.' },
      { role: 'user', content: text.slice(0, 500) },
    ],
    stream: false,
  });
  try {
    const raw = (result?.choices?.[0]?.message?.content || result?.content || '{}').trim();
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch { return { language: 'English', code: 'en', confidence: 0.5 }; }
}

// ── Extract Tables ──
export async function glmExtractTables(text: string): Promise<any[]> {
  const zai = await getZAI();
  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: 'Extract any tabular data from the text. Return ONLY a JSON array of tables: [{ "headers": ["col1","col2",...], "rows": [["val1","val2",...],...], "caption": "table description" }]. If no tables found, return empty array. No other text.' },
      { role: 'user', content: text.slice(0, 6000) },
    ],
    stream: false,
  });
  const raw = result?.choices?.[0]?.message?.content || result?.content || '[]';
  try {
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch { return []; }
}

// ── Web Clip Summary ──
export async function glmWebClip(html: string, url: string): Promise<{ title: string; content: string; summary: string }> {
  const zai = await getZAI();
  const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: 'You are a web article extractor. Given the text content of a web page, extract: 1) The article title 2) The main article content (clean, no navigation/ads) 3) A brief 2-sentence summary. Return ONLY a JSON object: { "title": "", "content": "", "summary": "" }. No other text.' },
      { role: 'user', content: `URL: ${url}\n\n${plainText}` },
    ],
    stream: false,
  });
  try {
    const raw = (result?.choices?.[0]?.message?.content || result?.content || '{}').trim();
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch { return { title: url, content: plainText.slice(0, 3000), summary: '' }; }
}

// ── Document Comparison ──
export async function glmCompare(text1: string, text2: string): Promise<{ similarities: string[]; differences: string[]; summary: string }> {
  const zai = await getZAI();
  const result = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: 'Compare two documents. Return ONLY a JSON object: { "similarities": ["point1",...], "differences": ["diff1",...], "summary": "overall comparison in 2-3 sentences" }. List 3-5 key similarities and 3-5 key differences. No other text.' },
      { role: 'user', content: `Document A:\n${text1.slice(0, 3000)}\n\nDocument B:\n${text2.slice(0, 3000)}` },
    ],
    stream: false,
  });
  try {
    const raw = (result?.choices?.[0]?.message?.content || result?.content || '{}').trim();
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch { return { similarities: [], differences: [], summary: 'Comparison failed' }; }
}
