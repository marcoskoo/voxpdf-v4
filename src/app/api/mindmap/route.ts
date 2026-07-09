import { NextRequest, NextResponse } from 'next/server';

// ── GLM Mind Map API — Generate concept tree using GLM LLM ──

export async function POST(req: NextRequest) {
  try {
    const { paragraphs, chapters, fileName } = await req.json();

    if (!paragraphs || !paragraphs.length) {
      return NextResponse.json({ error: 'No paragraphs provided' }, { status: 400 });
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    // Build a condensed document summary
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
        {
          role: 'system',
          content: `You are a concept mapping assistant. Generate a mind map / concept tree from the given document content. Return ONLY a JSON object with this structure: { "id": "root", "label": "Document Title", "children": [{ "id": "ch-0", "label": "Chapter/Concept", "children": [{ "id": "ch-0-s0", "label": "Sub-concept", "children": [] }] }] }. Maximum 3 levels deep. Each node needs "id", "label", "children" fields. No other text outside the JSON.`,
        },
        {
          role: 'user',
          content: `Document: "${fileName}"\n\n${docContent}`,
        },
      ],
      stream: false,
    });

    const raw = result?.choices?.[0]?.message?.content || result?.content || '{}';

    let mindMap;
    try {
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      mindMap = JSON.parse(jsonStr);
    } catch {
      // Fallback: create basic tree from chapters
      mindMap = {
        id: 'root',
        label: fileName || 'Documento',
        children: (chapters || []).slice(0, 15).map((ch: any, i: number) => ({
          id: `ch-${i}`,
          label: ch.title,
          children: [],
        })),
      };
    }

    return NextResponse.json({ mindMap });
  } catch (error: any) {
    console.error('GLM Mind Map error:', error);
    return NextResponse.json({ error: error.message || 'Mind map generation failed' }, { status: 500 });
  }
}
