import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { boardName, contentId } = await context.params;
    const normalizedBoardName = boardName.trim().toLowerCase();
    const normalizedContentId = contentId.trim();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = requestUrl.searchParams.get('siteName')?.trim().toLowerCase() ?? '';

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const rhizomeResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const manageResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', rhizomeResult.data.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (manageResult.error || !manageResult.data) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (boardResult.error || !boardResult.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (boardResult.data.board_type !== 'page') {
      return Response.json({ error: '페이지 게시판이 아닙니다.' }, { status: 400 });
    }

    const pageResult = await supabaseAdmin
      .from('pages')
      .select(
        'id, slug, subject, summary, content_html, content_markdown, created_at, edited_at, og_image, attachment_slug, attachment_origin, sort_order, user_id, site_id, board_id',
      )
      .eq('board_id', boardResult.data.id)
      .eq('slug', normalizedContentId)
      .maybeSingle();

    if (pageResult.error || !pageResult.data) {
      return Response.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
    }

    let authorName = '';

    const nicknameResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('nickname')
      .eq('site_id', rhizomeResult.data.id)
      .eq('user_id', pageResult.data.user_id)
      .maybeSingle();

    if (nicknameResult.data?.nickname) {
      authorName = nicknameResult.data.nickname;
    } else {
      const particleResult = await supabaseAdmin
        .from('particles')
        .select('id')
        .eq('id', pageResult.data.user_id)
        .maybeSingle();

      if (particleResult.data) {
        const authorStigmaResult = await supabaseAdmin
          .from('stigmas')
          .select('user_name')
          .eq('user_id', particleResult.data.id)
          .maybeSingle();

        if (authorStigmaResult.data?.user_name) {
          authorName = decrypt(authorStigmaResult.data.user_name);
        }
      }
    }

    let ogImageUrl = '';

    if (pageResult.data.og_image) {
      if (pageResult.data.og_image.startsWith('supabase:')) {
        const targetPath = pageResult.data.og_image.replace('supabase:', '').trim();
        const publicUrlResult = supabaseAdmin.storage.from('og-image').getPublicUrl(targetPath);
        ogImageUrl = publicUrlResult.data.publicUrl ?? '';
      } else {
        ogImageUrl = pageResult.data.og_image;
      }
    }

    return Response.json({
      board: boardResult.data,
      content: {
        ...pageResult.data,
        author_name: authorName,
        og_image_url: ogImageUrl,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '페이지 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '페이지 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
