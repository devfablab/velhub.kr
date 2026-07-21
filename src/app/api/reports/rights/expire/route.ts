import { getSupabaseAdmin } from '@/lib/supabase';

function isValidCronRequest(request: Request) {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'test') {
    return true;
  }

  const authorization = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error('자동 처리 실행 키가 설정되지 않았습니다.');
  }

  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  try {
    if (!isValidCronRequest(request)) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const nowIsoString = now.toISOString();

    const updateResult = await supabaseAdmin
      .from('report_rights')
      .update({
        status: 'completed',
        handled_at: nowIsoString,
        updated_at: nowIsoString,
      })
      .in('target_type', ['post', 'comment'])
      .in('status', ['received', 'reviewing'])
      .lte('created_at', cutoff)
      .select('id');

    if (updateResult.error) {
      console.error('[reports/rights/expire] update error', updateResult.error);
      return Response.json({ error: '권리침해 신고 만료 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      count: updateResult.data?.length ?? 0,
    });
  } catch (unknownError) {
    console.error('[reports/rights/expire] unexpected error', unknownError);

    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '권리침해 신고 만료 처리에 실패했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '권리침해 신고 만료 처리에 실패했습니다.' }, { status: 500 });
  }
}
