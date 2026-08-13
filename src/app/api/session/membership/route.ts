import { NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getMembershipFeatures } from '@/lib/memberships/features';

export async function GET() {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const features = await getMembershipFeatures(currentStigma.stigmaId);
    return NextResponse.json({ ok: features.has('affetto_my_posts') });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Failed to fetch membership features' }, { status: 500 });
  }
}
