import { NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getAuthorState } from '@/lib/session/author';

export async function GET() {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ ok: false }, { status: 401 });

  const { isAuthor } = await getAuthorState(currentStigma.stigmaId);
  return NextResponse.json({ ok: isAuthor }, { status: 200 });
}
