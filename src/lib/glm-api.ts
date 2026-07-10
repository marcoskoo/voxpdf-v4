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
