import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/glm-api';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const zai = await getZAI();
    const result = await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: 'Extract all dates/years and their associated events from the text. Return ONLY a JSON array: [{ "date": "YYYY or YYYY-MM-DD", "event": "what happened" }]. No other text.' },
        { role: 'user', content: text.slice(0, 6000) },
      ],
      stream: false,
    });

    const raw = result?.choices?.[0]?.message?.content || result?.content || '[]';
    try {
      const data = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      return NextResponse.json({ timeline: data });
    } catch {
      return NextResponse.json({ timeline: [] });
    }
  } catch (error: any) {
    console.error('Timeline error:', error);
    return NextResponse.json({ error: error.message || 'Timeline extraction failed' }, { status: 500 });
  }
}
