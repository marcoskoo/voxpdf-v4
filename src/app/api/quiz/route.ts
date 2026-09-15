import { NextRequest, NextResponse } from 'next/server';
import { glmQuiz } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { paragraphs, chapters, fileName } = await req.json();
    if (!paragraphs || !paragraphs.length) {
      return NextResponse.json({ error: 'No paragraphs provided' }, { status: 400 });
    }
    const quiz = await glmQuiz(paragraphs, chapters, fileName);
    return NextResponse.json({ quiz });
  } catch (error: any) {
    console.error('GLM Quiz error:', error);
    return NextResponse.json({ error: error.message || 'Quiz generation failed' }, { status: 500 });
  }
}
