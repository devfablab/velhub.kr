import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getHubPostDisplayMap } from '@/lib/service/hub/postDisplay';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type SiteType = 'blog' | 'community';

type SaveRow = {
  id: string;
  created_at: string;
  post_id: string;
};

function normalizeSiteType(value: string | null): SiteType | null {
  return value === 'blog' || value === 'community' ? value : null;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteType = normalizeSiteType(normalizeText(requestUrl.searchParams.get('siteType')).toLowerCase());

    if (!siteType) return Response.json({ error: 'siteType이 유효하지 않습니다.' }, { status: 400 });

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) return Response.json({ posts: [] });

    const savesResult = await getSupabaseAdmin()
      .from('post_saves')
      .select('id, created_at, post_id')
      .eq('user_id', session.stigmaId ?? '')
      .order('created_at', { ascending: false })
      .limit(50);

    if (savesResult.error) return Response.json({ error: '저장한 글 목록을 불러오지 못했습니다.' }, { status: 500 });

    const saves = (savesResult.data ?? []) as SaveRow[];
    const postMap = await getHubPostDisplayMap({
      postIds: saves.map((save) => save.post_id),
      siteType,
      viewerStigmaId: session.stigmaId,
    });
    const posts = saves.flatMap((save) => {
      const post = postMap.get(save.post_id);

      return post && post.isPublished && !post.isClosed ? [{ id: save.id, date: save.created_at, post }] : [];
    });

    return Response.json({ posts });
  } catch (unknownError) {
    return Response.json(
      {
        error:
          unknownError instanceof Error
            ? unknownError.message || '저장한 글 목록을 불러오지 못했습니다.'
            : '저장한 글 목록을 불러오지 못했습니다.',
      },
      { status: 500 },
    );
  }
}
