import { NextRequest, NextResponse } from 'next/server';
import { glmDetectLanguage } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    const result = await glmDetectLanguage(text);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GLM Detect Language error:', error);
    return NextResponse.json({ error: error.message || 'Language detection failed' }, { status: 500 });
  }
}
