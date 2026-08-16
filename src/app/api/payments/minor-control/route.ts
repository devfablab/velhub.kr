import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const current = await getCurrentStigma();
  if (!current) return Response.json({ mode: null });
  const db = getSupabaseAdmin();
  const { data: identity } = await db.from('chorogons').select('id').eq('user_id', current.stigmaId).maybeSingle();
  if (!identity) return Response.json({ mode: null });
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const { data: control } = await db
    .from('payment_minor_controls')
    .select('mode, effective_until')
    .eq('chorogon_id', identity.id)
    .gte('effective_until', today)
    .maybeSingle();
  return Response.json({ mode: control?.mode ?? null, effectiveUntil: control?.effective_until ?? null });
}
