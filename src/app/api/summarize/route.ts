import { NextRequest, NextResponse } from 'next/server';
import { glmSummarize } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { text, mode } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const summary = await glmSummarize(text, mode || 'brief');
    return NextResponse.json({ summary, mode: mode || 'brief' });
  } catch (error: any) {
    console.error('GLM Summarize error:', error);
    return NextResponse.json({ error: error.message || 'Summarization failed' }, { status: 500 });
  }
}
