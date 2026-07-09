import { NextRequest, NextResponse } from 'next/server';

// ── GLM Glossary API — Define terms using GLM LLM ──

export async function POST(req: NextRequest) {
  try {
    const { term, context } = await req.json();

    if (!term) {
      return NextResponse.json({ error: 'Missing term' }, { status: 400 });
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const result = await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: `You are a dictionary/glossary assistant. Given a term and optional context, provide a concise definition in the same language as the term. Return ONLY the definition, nothing else. Keep it to 1-2 sentences maximum.`,
        },
        {
          role: 'user',
          content: context
            ? `Term: "${term}"\nContext: "${context}"\n\nDefine this term based on the context.`
            : `Define: "${term}"`,
        },
      ],
      stream: false,
    });

    const definition = result?.choices?.[0]?.message?.content || result?.content || '';

    return NextResponse.json({
      term,
      definition: definition.trim(),
    });
  } catch (error: any) {
    console.error('GLM Glossary error:', error);
    return NextResponse.json({ error: error.message || 'Glossary lookup failed' }, { status: 500 });
  }
}
