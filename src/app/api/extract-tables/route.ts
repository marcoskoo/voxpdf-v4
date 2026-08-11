import { NextRequest, NextResponse } from 'next/server';
import { glmExtractTables } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    const tables = await glmExtractTables(text);
    return NextResponse.json({ tables });
  } catch (error: any) {
    console.error('GLM Extract Tables error:', error);
    return NextResponse.json({ error: error.message || 'Table extraction failed' }, { status: 500 });
  }
}
