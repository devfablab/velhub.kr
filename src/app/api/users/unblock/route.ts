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
    const now = new Date().toISOString();

    const updateResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        is_block: false,
        blocked_at: null,
        blocked_by: null,
        block_term: null,
      })
      .eq('is_block', true)
      .not('blocked_at', 'is', null)
      .not('block_term', 'is', null)
      .lte('block_term', now)
      .select('id');

    if (updateResult.error) {
      console.error('[users/unblock] update error', updateResult.error);
      return Response.json({ error: '활동정지 기간 만료 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      count: updateResult.data?.length ?? 0,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '활동정지 기간 만료 처리에 실패했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '활동정지 기간 만료 처리에 실패했습니다.' }, { status: 500 });
  }
}
