import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/erp-assistant/auth';
import { checkRateLimit } from '@/lib/erp-assistant/rateLimit';
import { tryFastPath } from '@/lib/erp-assistant/fastPath';
import { isGeminiConfigured, runErpAssistant, type ChatMessage } from '@/lib/erp-assistant/llm/gemini';

const GEMINI_TIMEOUT_MS = 55_000;

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    configured: isGeminiConfigured(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        {
          error: 'ASSISTANT_NOT_CONFIGURED',
          reply:
            'ERP Assistant is not configured yet. Add GEMINI_API_KEY to .env.local on the server.',
        },
        { status: 503 }
      );
    }

    const rate = checkRateLimit(user.id);
    if (!rate.ok) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rate.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];

    const messages: ChatMessage[] = rawMessages
      .filter(
        (m: { role?: string; content?: string }) =>
          (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
      )
      .slice(-20)
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content.trim(),
      }))
      .filter((m: ChatMessage) => m.content.length > 0);

    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'A user message is required' }, { status: 400 });
    }

    const lastText = messages[messages.length - 1].content;
    const t0 = Date.now();

    const fast = await tryFastPath(user, lastText);
    if (fast) {
      console.log(`[ERP Assistant] fast path ${Date.now() - t0}ms`);
      return NextResponse.json({ reply: fast.reply, sources: fast.sources, mode: 'fast' });
    }

    const geminiPromise = runErpAssistant(user, messages);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('ASSISTANT_TIMEOUT')), GEMINI_TIMEOUT_MS);
    });

    const { reply, sources } = await Promise.race([geminiPromise, timeoutPromise]);
    console.log(`[ERP Assistant] gemini ${Date.now() - t0}ms`);

    return NextResponse.json({ reply, sources, mode: 'gemini' });
  } catch (error) {
    console.error('ERP assistant error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'ASSISTANT_NOT_CONFIGURED') {
      return NextResponse.json(
        {
          error: message,
          reply: 'ERP Assistant is not configured. Set GEMINI_API_KEY in .env.local.',
        },
        { status: 503 }
      );
    }
    if (message === 'ASSISTANT_TIMEOUT') {
      return NextResponse.json(
        {
          error: message,
          reply:
            'The AI model took too long to respond. Try a shorter question like “My pending delegations” or try again in a minute.',
        },
        { status: 504 }
      );
    }
    if (message === 'ASSISTANT_OVERLOADED') {
      return NextResponse.json(
        {
          error: message,
          reply:
            'Google AI is busy right now (high demand). Please wait a minute and try again, or set GEMINI_MODEL=gemini-flash-lite-latest in .env.local.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: 'Failed to get assistant response',
        reply: 'The assistant is temporarily unavailable. Please try again.',
      },
      { status: 500 }
    );
  }
}
