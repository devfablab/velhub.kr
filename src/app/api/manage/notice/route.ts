import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getNoticeContext, NOTICE_DEFAULT_BOARD_LABEL } from '@/lib/service/blog/notice/access';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName?: string | null;
  isEnabled?: unknown;
};

// 개인 블로그 운영자만 접근. 그 외에는 관리 홈으로 보내도록 redirect 표시
async function checkAccess(siteName: string) {
  const notice = await getNoticeContext(siteName);

  if (!notice) {
    return { ok: false, status: 404, error: '블로그를 찾을 수 없습니다.', redirect: false } as const;
  }

  if (!notice.isPersonalBlog || !notice.isOwner) {
    return { ok: false, status: 403, error: '접근 권한이 없습니다.', redirect: true } as const;
  }

  return { ok: true, notice } as const;
}

export async function GET(request: Request) {
  try {
    const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error, redirect: access.redirect }, { status: access.status });
    }

    return Response.json({
      isEnabled: access.notice.board?.is_enabled === true,
      boardLabel: access.notice.board?.board_label ?? NOTICE_DEFAULT_BOARD_LABEL,
    });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '공지 설정을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const requestBody = (await request.json().catch(() => null)) as RequestBody | null;
    const siteName = normalizeText(requestBody?.siteName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (typeof requestBody?.isEnabled !== 'boolean') {
      return Response.json({ error: '활성화 여부가 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error, redirect: access.redirect }, { status: access.status });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const isEnabled = requestBody.isEnabled;

    // 처음 활성화할 때 게시판 생성. 비활성화해도 게시판/글은 유지
    const result = access.notice.board
      ? await supabaseAdmin
          .from('notice_boards')
          .update({ is_enabled: isEnabled })
          .eq('id', access.notice.board.id)
          .select('is_enabled, board_label')
          .single()
      : await supabaseAdmin
          .from('notice_boards')
          .insert({ site_id: access.notice.siteId, board_label: NOTICE_DEFAULT_BOARD_LABEL, is_enabled: isEnabled })
          .select('is_enabled, board_label')
          .single();

    if (result.error || !result.data) {
      return Response.json({ error: '공지 설정을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      isEnabled: result.data.is_enabled,
      boardLabel: result.data.board_label,
    });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '공지 설정을 저장하지 못했습니다.' }, { status: 500 });
  }
}
