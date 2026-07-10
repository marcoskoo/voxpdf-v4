import { NextRequest, NextResponse } from 'next/server';
import { glmDefine } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { term, context } = await req.json();
    if (!term) {
      return NextResponse.json({ error: 'Missing term' }, { status: 400 });
    }

    const definition = await glmDefine(term, context || '');
    return NextResponse.json({ term, definition });
  } catch (error: any) {
    console.error('GLM Glossary error:', error);
    return NextResponse.json({ error: error.message || 'Glossary lookup failed' }, { status: 500 });
  }
}
