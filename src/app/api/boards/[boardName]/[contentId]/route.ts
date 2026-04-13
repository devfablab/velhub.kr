import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

type AccessResult = {
  ok: boolean;
  status: number;
  error?: string;
  siteId?: string;
};

async function checkReadAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, visibility_type, is_shutdown')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } satisfies AccessResult;
  }

  const rhizome = rhizomeResult.data;
  const sessionClaims = await getSessionClaims();

  if (rhizome.is_shutdown) {
    if (!sessionClaims) {
      return {
        ok: false,
        status: 401,
        error: '로그인이 필요합니다.',
      } satisfies AccessResult;
    }

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return {
        ok: false,
        status: 500,
        error: '사용자 정보를 확인하지 못했습니다.',
      } satisfies AccessResult;
    }

    const manageResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', rhizome.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (manageResult.error || !manageResult.data) {
      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } satisfies AccessResult;
    }

    return {
      ok: true,
      status: 200,
      siteId: rhizome.id,
    } satisfies AccessResult;
  }

  if (rhizome.visibility_type === 'public') {
    return {
      ok: true,
      status: 200,
      siteId: rhizome.id,
    } satisfies AccessResult;
  }

  if (!sessionClaims) {
    return {
      ok: false,
      status: 401,
      error: '로그인이 필요합니다.',
    } satisfies AccessResult;
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return {
      ok: false,
      status: 500,
      error: '사용자 정보를 확인하지 못했습니다.',
    } satisfies AccessResult;
  }

  const accessResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id')
    .eq('site_id', rhizome.id)
    .eq('user_id', stigmaResult.data.id)
    .eq('is_approval', true)
    .eq('is_block', false)
    .maybeSingle();

  if (accessResult.error || !accessResult.data) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } satisfies AccessResult;
  }

  return {
    ok: true,
    status: 200,
    siteId: rhizome.id,
  } satisfies AccessResult;
}

export async function GET(request: Request, context: RouteContext) {
  try {
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

    const accessResult = await checkReadAccess(siteName);

    if (!accessResult.ok || !accessResult.siteId) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id')
      .eq('site_id', accessResult.siteId)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (boardResult.error || !boardResult.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (boardResult.data.board_type === 'page') {
      const pageResult = await supabaseAdmin
        .from('pages')
        .select(
          'id, slug, subject, summary, content_html, content_markdown, created_at, edited_at, og_image, attachment_slug, attachment_origin, sort_order, user_id, site_id, board_id, is_comment',
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
        .eq('site_id', accessResult.siteId)
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
    }

    if (boardResult.data.board_type === 'blog') {
      const numericContentId = Number(normalizedContentId);

      const postResult = await supabaseAdmin
        .from('posts')
        .select(
          'id, user_id, slug, content_html, content_markdown, subject, summary, edited_at, thumbnail_image, thumbnail_width, thumbnail_height, idx, board_id, site_id, created_at',
        )
        .eq('board_id', boardResult.data.id)
        .eq('slug', Number.isFinite(numericContentId) ? numericContentId : -1)
        .maybeSingle();

      if (postResult.error || !postResult.data) {
        return Response.json({ error: '블로그 글을 찾을 수 없습니다.' }, { status: 404 });
      }

      let authorName = '';

      const nicknameResult = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('nickname')
        .eq('site_id', accessResult.siteId)
        .eq('user_id', postResult.data.user_id)
        .maybeSingle();

      if (nicknameResult.data?.nickname) {
        authorName = nicknameResult.data.nickname;
      } else {
        const particleResult = await supabaseAdmin
          .from('particles')
          .select('id')
          .eq('id', postResult.data.user_id)
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

      let thumbnailImageUrl = '';

      if (postResult.data.thumbnail_image) {
        if (postResult.data.thumbnail_image.startsWith('supabase:')) {
          const targetPath = postResult.data.thumbnail_image.replace('supabase:', '').trim();
          const publicUrlResult = supabaseAdmin.storage.from('og-image').getPublicUrl(targetPath);
          thumbnailImageUrl = publicUrlResult.data.publicUrl ?? '';
        } else {
          thumbnailImageUrl = postResult.data.thumbnail_image;
        }
      }

      return Response.json({
        board: boardResult.data,
        content: {
          ...postResult.data,
          slug: String(postResult.data.slug),
          author_name: authorName,
          thumbnail_image_url: thumbnailImageUrl,
        },
      });
    }

    return Response.json({ error: '지원하지 않는 게시판 종류입니다.' }, { status: 400 });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '콘텐츠 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '콘텐츠 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
