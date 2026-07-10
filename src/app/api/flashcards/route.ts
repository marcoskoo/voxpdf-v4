import { NextRequest, NextResponse } from 'next/server';

// ── GLM Flashcards API — Generate smart flashcards using GLM LLM ──

export async function POST(req: NextRequest) {
  try {
    const { paragraphs, chapters, fileName } = await req.json();

    if (!paragraphs || !paragraphs.length) {
      return NextResponse.json({ error: 'No paragraphs provided' }, { status: 400 });
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    // Build a condensed text from the document for flashcard generation
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
        {
          role: 'system',
          content: `You are a study assistant. Generate flashcards from the given document content. Each flashcard should have a question/concept on the front and a clear, concise answer on the back. Return ONLY a JSON array of objects with "front", "back", "tags" (array of strings), and "deck" (string) fields. No other text. Generate between 5 and 20 flashcards covering the key concepts.`,
        },
        {
          role: 'user',
          content: `Document: "${fileName}"\n\n${docSummary}`,
        },
      ],
      stream: false,
    });

    const raw = result?.choices?.[0]?.message?.content || result?.content || '[]';

    // Parse JSON from response (handle markdown code blocks)
    let cards;
    try {
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      cards = JSON.parse(jsonStr);
    } catch {
      // Fallback: create simple cards from the raw text
      cards = [{
        front: 'Resumen del documento',
        back: raw.slice(0, 200),
        tags: [fileName || 'document'],
        deck: (fileName || 'document').replace(/\.\w+$/, ''),
      }];
    }

    return NextResponse.json({ flashcards: cards });
  } catch (error: any) {
    console.error('GLM Flashcards error:', error);
    return NextResponse.json({ error: error.message || 'Flashcard generation failed' }, { status: 500 });
  }
}
