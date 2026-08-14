import { NextResponse } from 'next/server';
import { getAuthorState } from '@/lib/session/author';
import { getCurrentStigma } from '@/lib/session/utils';

export async function GET() {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ ok: false }, { status: 401 });

  const { isAuthor } = await getAuthorState(currentStigma.stigmaId);
  return NextResponse.json({ ok: isAuthor }, { status: 200 });
}
