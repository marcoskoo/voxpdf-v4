import { NextRequest, NextResponse } from 'next/server';
import { glmCitations } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    const citations = await glmCitations(text);
    return NextResponse.json({ citations });
  } catch (error: any) {
    console.error('GLM Citations error:', error);
    return NextResponse.json({ error: error.message || 'Citation detection failed' }, { status: 500 });
  }
}
