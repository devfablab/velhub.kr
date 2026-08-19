import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'test') {
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  
  const { data: mocks, error } = await supabaseAdmin
    .from('mock_identities')
    .select('id, name, birth_date, gender, verification_tx_id')
    .order('created_at', { ascending: false });

  if (error || !mocks) {
    return NextResponse.json({ message: 'Failed to fetch mock identities' }, { status: 500 });
  }

  const { data: chorogons } = await supabaseAdmin
    .from('chorogons')
    .select('verification_tx_id')
    .not('verification_tx_id', 'is', null);

  const usedTxIds = new Set((chorogons || []).map((c: { verification_tx_id: string }) => c.verification_tx_id));

  const result = mocks.map((m: { id: string; name: string; birth_date: string; gender: string; verification_tx_id: string }) => ({
    id: m.id,
    name: m.name,
    birth_date: m.birth_date,
    gender: m.gender,
    verification_tx_id: m.verification_tx_id,
    used: usedTxIds.has(m.verification_tx_id),
  }));

  return NextResponse.json(result);
}
