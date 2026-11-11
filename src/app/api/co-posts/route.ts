import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { CO_POST_COLUMNS, type CoPostRow, getPersonalBlogOwner } from '@/lib/service/blog/coPosts';
import verifySession from '@/lib/session/verifySession';
import { decryptNullable } from '@/lib/users/utils';
import { normalizeText } from '@/lib/utils';

type SiteRow = { id: string; site_key: string; site_label: string | null };
type PostRow = {
  id: string;
  subject: string | null;
  slug: string;
  published_status: string;
  published_at: string | null;
};

export async function GET(request: Request) {
  try {
    const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();
    const supabaseAdmin = getSupabaseAdmin();
    const siteResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return NextResponse.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    }

    const siteId = siteResult.data.id as string;
    const session = await verifySession({ siteId });
    const owner = await getPersonalBlogOwner(siteId);

    if (!session.stigmaId || !owner || owner.ownerId !== session.stigmaId) {
      return NextResponse.json({ error: '공동 집필은 1인 블로그 운영자만 볼 수 있습니다.' }, { status: 403 });
    }

    const stigmaId = session.stigmaId;
    const [coPostResult, boardResult] = await Promise.all([
      supabaseAdmin
        .from('co_posts')
        .select(CO_POST_COLUMNS)
        .in('status', ['invited', 'active'])
        .or(
          `and(inviter_site_id.eq.${siteId},inviter_id.eq.${stigmaId}),and(partner_site_id.eq.${siteId},partner_id.eq.${stigmaId})`,
        )
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('boards').select('board_key').eq('site_id', siteId).eq('board_type', 'blog').maybeSingle(),
    ]);

    if (coPostResult.error) {
      throw new Error('공동 집필 목록을 불러오지 못했습니다.');
    }

    const coPosts = (coPostResult.data ?? []) as CoPostRow[];
    const otherSiteIds = coPosts.map((coPost) =>
      coPost.inviter_id === stigmaId ? coPost.partner_site_id : coPost.inviter_site_id,
    );
    const otherUserIds = coPosts.map((coPost) =>
      coPost.inviter_id === stigmaId ? coPost.partner_id : coPost.inviter_id,
    );
    const [sitesResult, postsResult, membershipsResult, stigmasResult] = await Promise.all([
      otherSiteIds.length
        ? supabaseAdmin.from('rhizomes').select('id, site_key, site_label').in('id', otherSiteIds)
        : Promise.resolve({ data: [] as SiteRow[], error: null }),
      coPosts.length
        ? supabaseAdmin
            .from('posts')
            .select('id, subject, slug, published_status, published_at')
            .in(
              'id',
              coPosts.map((coPost) => coPost.post_id),
            )
        : Promise.resolve({ data: [] as PostRow[], error: null }),
      otherUserIds.length
        ? supabaseAdmin.from('rhizome_stigmas').select('site_id, user_id, nickname').in('user_id', otherUserIds)
        : Promise.resolve({ data: [] as { site_id: string; user_id: string; nickname: string | null }[], error: null }),
      otherUserIds.length
        ? supabaseAdmin.from('stigmas').select('id, user_name').in('id', otherUserIds)
        : Promise.resolve({ data: [] as { id: string; user_name: string | null }[], error: null }),
    ]);

    const siteById = new Map(((sitesResult.data ?? []) as SiteRow[]).map((site) => [site.id, site]));
    const postById = new Map(((postsResult.data ?? []) as PostRow[]).map((post) => [post.id, post]));
    const nicknameByKey = new Map(
      (membershipsResult.data ?? []).map((row) => [`${row.site_id}:${row.user_id}`, normalizeText(row.nickname)]),
    );
    const userNameById = new Map(
      (stigmasResult.data ?? []).map((row) => [row.id as string, normalizeText(decryptNullable(row.user_name))]),
    );

    return NextResponse.json({
      boardName: boardResult.data?.board_key ?? null,
      coPosts: coPosts.map((coPost) => {
        const isInviter = coPost.inviter_id === stigmaId;
        const otherSiteId = isInviter ? coPost.partner_site_id : coPost.inviter_site_id;
        const otherUserId = isInviter ? coPost.partner_id : coPost.inviter_id;
        const otherSite = siteById.get(otherSiteId);
        const post = postById.get(coPost.post_id);

        return {
          id: coPost.id,
          role: isInviter ? 'inviter' : 'partner',
          status: coPost.status,
          createdAt: coPost.created_at,
          post: post
            ? {
                subject: post.subject ?? '',
                slug: post.slug,
                publishedStatus: post.published_status,
                publishedAt: post.published_at,
              }
            : null,
          other: {
            siteKey: otherSite?.site_key ?? '',
            siteLabel: normalizeText(otherSite?.site_label) || otherSite?.site_key || '',
            ownerName: nicknameByKey.get(`${otherSiteId}:${otherUserId}`) || userNameById.get(otherUserId) || '',
          },
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '공동 집필 목록을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
