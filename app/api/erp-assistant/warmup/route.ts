import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/erp-assistant/auth';
import { queryDelegations, queryTodos } from '@/lib/erp-assistant/queries/tasks';

export const dynamic = 'force-dynamic';

/** Pre-load common sheet data into assistant cache when the panel opens. */
export async function GET(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await Promise.allSettled([
    queryDelegations(user, { limit: 1 }),
    queryTodos(user, { limit: 1 }),
  ]);

  return NextResponse.json({ ok: true });
}
