import { NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const membershipResult = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('target_id', currentStigma.stigmaId)
    .eq('subscription_type', 'affetto_my_posts')
    .in('status', ['trialing', 'active', 'past_due'])
    .maybeSingle();

  return NextResponse.json({ ok: !!membershipResult.data });
}
