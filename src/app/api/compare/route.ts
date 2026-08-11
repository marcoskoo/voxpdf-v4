import { NextRequest, NextResponse } from 'next/server';
import { glmCompare } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { text1, text2 } = await req.json();
    if (!text1 || !text2) return NextResponse.json({ error: 'Missing text1 or text2' }, { status: 400 });
    const comparison = await glmCompare(text1, text2);
    return NextResponse.json(comparison);
  } catch (error: any) {
    console.error('GLM Compare error:', error);
    return NextResponse.json({ error: error.message || 'Comparison failed' }, { status: 500 });
  }
}
