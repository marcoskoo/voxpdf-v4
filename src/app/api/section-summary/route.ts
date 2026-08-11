import { NextRequest, NextResponse } from 'next/server';
import { glmSectionSummary } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { sections } = await req.json();
    if (!sections || !sections.length) return NextResponse.json({ error: 'No sections provided' }, { status: 400 });
    const summaries = await glmSectionSummary(sections);
    return NextResponse.json({ summaries });
  } catch (error: any) {
    console.error('GLM Section Summary error:', error);
    return NextResponse.json({ error: error.message || 'Section summary failed' }, { status: 500 });
  }
}
