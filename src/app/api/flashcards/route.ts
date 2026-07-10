import { NextRequest, NextResponse } from 'next/server';
import { glmFlashcards } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { paragraphs, chapters, fileName } = await req.json();
    if (!paragraphs || !paragraphs.length) {
      return NextResponse.json({ error: 'No paragraphs provided' }, { status: 400 });
    }

    const flashcards = await glmFlashcards(paragraphs, chapters, fileName);
    return NextResponse.json({ flashcards });
  } catch (error: any) {
    console.error('GLM Flashcards error:', error);
    return NextResponse.json({ error: error.message || 'Flashcard generation failed' }, { status: 500 });
  }
}
