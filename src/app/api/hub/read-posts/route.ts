import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getHubPostDisplayMap } from '@/lib/service/hub/postDisplay';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type SiteType = 'blog' | 'community';

type ReadRow = {
  id: string;
  read_at: string;
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

    const readsResult = await getSupabaseAdmin()
      .from('post_reads')
      .select('id, read_at, post_id')
      .eq('user_id', session.stigmaId ?? '')
      .order('read_at', { ascending: false })
      .limit(50);

    if (readsResult.error) return Response.json({ error: '읽은 글 목록을 불러오지 못했습니다.' }, { status: 500 });

    const reads = (readsResult.data ?? []) as ReadRow[];
    const postMap = await getHubPostDisplayMap({
      postIds: reads.map((read) => read.post_id),
      siteType,
      viewerStigmaId: session.stigmaId,
    });
    const posts = reads.flatMap((read) => {
      const post = postMap.get(read.post_id);

      return post && post.isPublished && !post.isClosed ? [{ id: read.id, date: read.read_at, post }] : [];
    });

    return Response.json({ posts });
  } catch (unknownError) {
    return Response.json(
      {
        error:
          unknownError instanceof Error
            ? unknownError.message || '읽은 글 목록을 불러오지 못했습니다.'
            : '읽은 글 목록을 불러오지 못했습니다.',
      },
      { status: 500 },
    );
  }
}
