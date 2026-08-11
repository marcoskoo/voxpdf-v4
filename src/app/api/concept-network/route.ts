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
        { role: 'system', content: 'Extract concept relationships from the text. Return ONLY JSON: { "nodes": [{ "id": "c1", "label": "Concept" }], "edges": [{ "source": "c1", "target": "c2", "label": "relates to" }] }. Max 15 nodes, 20 edges. No other text.' },
        { role: 'user', content: text.slice(0, 4000) },
      ],
      stream: false,
    });

    const raw = result?.choices?.[0]?.message?.content || result?.content || '{}';
    try {
      const data = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      return NextResponse.json({ network: data });
    } catch {
      return NextResponse.json({ network: { nodes: [], edges: [] } });
    }
  } catch (error: any) {
    console.error('Concept network error:', error);
    return NextResponse.json({ error: error.message || 'Concept network extraction failed' }, { status: 500 });
  }
}
