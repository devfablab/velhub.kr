import { NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getLibraryStatus } from '@/lib/session/libraryStatus';

export async function GET() {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const status = await getLibraryStatus(currentStigma.stigmaId);
    return NextResponse.json({ ok: true, ...status }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
