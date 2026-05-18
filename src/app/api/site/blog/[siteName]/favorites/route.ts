import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

async function getTargetBlog(siteName: string) {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    return null;
  }

  if (siteResult.data.site_type !== 'blog') {
    return null;
  }

  return {
    siteId: siteResult.data.id as string,
    siteKey: siteResult.data.site_key as string,
  };
}

async function getFavoriteCount(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const countResult = await supabaseAdmin
    .from('blog_favorites')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId);

  if (countResult.error) {
    throw new Error('즐겨찾기 수를 확인하지 못했습니다.');
  }

  return countResult.count ?? 0;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const targetBlog = await getTargetBlog(siteName);

    if (!targetBlog) {
      return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: targetBlog.siteId,
    });

    const favoriteCount = await getFavoriteCount(targetBlog.siteId);

    if (!session.authUserId) {
      return Response.json({
        isLoggedIn: false,
        isFavorited: false,
        favoriteCount,
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const favoriteResult = await supabaseAdmin
      .from('blog_favorites')
      .select('id')
      .eq('user_id', session.authUserId)
      .eq('site_id', targetBlog.siteId)
      .limit(1);

    if (favoriteResult.error) {
      return Response.json({ error: '즐겨찾기 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      isLoggedIn: true,
      isFavorited: (favoriteResult.data ?? []).length > 0,
      favoriteCount,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '즐겨찾기 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '즐겨찾기 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const targetBlog = await getTargetBlog(siteName);

    if (!targetBlog) {
      return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: targetBlog.siteId,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const existingResult = await supabaseAdmin
      .from('blog_favorites')
      .select('id')
      .eq('user_id', session.authUserId)
      .eq('site_id', targetBlog.siteId)
      .limit(1);

    if (existingResult.error) {
      return Response.json({ error: '즐겨찾기 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const isFavorited = (existingResult.data ?? []).length > 0;

    if (isFavorited) {
      const deleteResult = await supabaseAdmin
        .from('blog_favorites')
        .delete()
        .eq('user_id', session.authUserId)
        .eq('site_id', targetBlog.siteId);

      if (deleteResult.error) {
        return Response.json({ error: '즐겨찾기를 취소하지 못했습니다.' }, { status: 500 });
      }
    } else {
      const insertResult = await supabaseAdmin.from('blog_favorites').insert({
        user_id: session.authUserId,
        site_id: targetBlog.siteId,
      });

      if (insertResult.error) {
        return Response.json({ error: '즐겨찾기를 저장하지 못했습니다.' }, { status: 500 });
      }
    }

    const favoriteCount = await getFavoriteCount(targetBlog.siteId);

    return Response.json({
      ok: true,
      isFavorited: !isFavorited,
      favoriteCount,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '즐겨찾기를 처리하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '즐겨찾기를 처리하지 못했습니다.' }, { status: 500 });
  }
}
