import { NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ ok: false }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const identityResult = await supabaseAdmin.from('chorogons').select('id').eq('user_id', currentStigma.stigmaId).maybeSingle();
  if (identityResult.error || !identityResult.data) return NextResponse.json({ ok: false }, { status: 200 });

  const settlementResult = await supabaseAdmin
    .from('chorogons_banque')
    .select('is_author')
    .eq('chorogon_id', identityResult.data.id)
    .maybeSingle();

  if (settlementResult.data?.is_author) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  return NextResponse.json({ ok: false }, { status: 200 });
}
