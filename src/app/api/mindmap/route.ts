import { NextRequest, NextResponse } from 'next/server';
import { glmMindMap } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { paragraphs, chapters, fileName } = await req.json();
    if (!paragraphs || !paragraphs.length) {
      return NextResponse.json({ error: 'No paragraphs provided' }, { status: 400 });
    }

    const mindMap = await glmMindMap(paragraphs, chapters, fileName);
    return NextResponse.json({ mindMap });
  } catch (error: any) {
    console.error('GLM Mind Map error:', error);
    return NextResponse.json({ error: error.message || 'Mind map generation failed' }, { status: 500 });
  }
}
