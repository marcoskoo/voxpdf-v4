import { NextRequest, NextResponse } from 'next/server';
import { glmWebClip } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { html, url } = await req.json();
    if (!html && !url) return NextResponse.json({ error: 'Missing html or url' }, { status: 400 });
    const result = await glmWebClip(html || '', url || '');
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GLM Web Clip error:', error);
    return NextResponse.json({ error: error.message || 'Web clip failed' }, { status: 500 });
  }
}
