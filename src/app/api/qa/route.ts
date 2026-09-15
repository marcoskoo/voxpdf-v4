import { NextRequest, NextResponse } from 'next/server';
import { glmQA } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { question, context, history } = await req.json();
    if (!question || !context) {
      return NextResponse.json({ error: 'Missing question or context' }, { status: 400 });
    }
    const answer = await glmQA(question, context, history || []);
    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error('GLM QA error:', error);
    return NextResponse.json({ error: error.message || 'QA failed' }, { status: 500 });
  }
}
