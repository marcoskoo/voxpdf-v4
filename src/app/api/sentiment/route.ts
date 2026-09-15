import { NextRequest, NextResponse } from 'next/server';
import { glmSentiment } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { sections } = await req.json();
    if (!sections || !sections.length) return NextResponse.json({ error: 'No sections provided' }, { status: 400 });
    const results = await glmSentiment(sections);
    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('GLM Sentiment error:', error);
    return NextResponse.json({ error: error.message || 'Sentiment analysis failed' }, { status: 500 });
  }
}
