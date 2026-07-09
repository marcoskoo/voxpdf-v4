import { NextRequest, NextResponse } from 'next/server';

// ── GLM Summarize API — Summarize document using GLM LLM ──

export async function POST(req: NextRequest) {
  try {
    const { text, mode } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const promptMap: Record<string, string> = {
      brief: 'Provide a brief 2-3 sentence summary.',
      detailed: 'Provide a detailed summary covering all main points, key arguments, and conclusions. Use 5-8 sentences.',
      bullet: 'Provide a bullet-point summary with the key takeaways. Use • for each point.',
      academic: 'Provide an academic-style abstract summary in one paragraph.',
    };

    const instruction = promptMap[mode || 'brief'] || promptMap.brief;

    const result = await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: `You are a document summarization assistant. ${instruction} Return ONLY the summary, nothing else. Write in the same language as the original text.`,
        },
        {
          role: 'user',
          content: text.slice(0, 8000),
        },
      ],
      stream: false,
    });

    const summary = result?.choices?.[0]?.message?.content || result?.content || '';

    return NextResponse.json({
      summary: summary.trim(),
      mode: mode || 'brief',
    });
  } catch (error: any) {
    console.error('GLM Summarize error:', error);
    return NextResponse.json({ error: error.message || 'Summarization failed' }, { status: 500 });
  }
}
