import { NextResponse } from 'next/server';
import { getMembershipFeatures } from '@/lib/memberships/features';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

const SELECTOR_TYPES = ['owner_site', 'creator_site', 'creator_own_post', 'creator_other_post'] as const;
type SelectorType = (typeof SELECTOR_TYPES)[number];

type Site = { id: string; site_key: string; site_label: string; site_type: string };
type Post = { id: string; site_id: string; subject: string | null; slug: number | null };
type PostOption = { id: string; subject: string; slug: number | null; siteKey: string; siteLabel: string };

function isSelectorType(value: unknown): value is SelectorType {
  return typeof value === 'string' && SELECTOR_TYPES.includes(value as SelectorType);
}

function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPostOption(value: PostOption | null): value is PostOption {
  return value !== null;
}

async function getSelectorData(stigmaId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const [features, sitesResult, postsResult, selectionsResult] = await Promise.all([
    getMembershipFeatures(stigmaId),
    supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, site_type')
      .eq('owner_id', stigmaId)
      .eq('is_shutdown', false)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('posts')
      .select('id, site_id, subject, slug')
      .eq('user_id', stigmaId)
      .not('series_id', 'is', null)
      .eq('published_status', 'published')
      .eq('is_closed', false)
      .order('published_at', { ascending: false }),
    supabaseAdmin.from('membership_selectors').select('selector_type, target_id').eq('user_id', stigmaId),
  ]);
  if (sitesResult.error) {
    console.error('[Membership Selectors API] Failed to fetch sites:', sitesResult.error);
    throw new Error('내 사이트 목록을 불러오는 중 오류가 발생했습니다.');
  }
  if (postsResult.error) {
    console.error('[Membership Selectors API] Failed to fetch posts:', postsResult.error);
    throw new Error('내 연재글 목록을 불러오는 중 오류가 발생했습니다.');
  }
  if (selectionsResult.error) {
    console.error('[Membership Selectors API] Failed to fetch selections:', selectionsResult.error);
    throw new Error('기존 노출 대상 설정을 불러오는 중 오류가 발생했습니다.');
  }

  const sites = (sitesResult.data ?? []) as Site[];
  const posts = (postsResult.data ?? []) as Post[];
  const ownSiteIds = new Set(sites.map((site) => site.id));
  const siteIds = Array.from(new Set(posts.map((post) => post.site_id).filter((siteId) => !ownSiteIds.has(siteId))));
  const otherSitesResult = siteIds.length
    ? await supabaseAdmin
        .from('rhizomes')
        .select('id, site_key, site_label, site_type')
        .in('id', siteIds)
        .eq('is_shutdown', false)
    : { data: [], error: null };

  if (otherSitesResult.error) throw new Error('연재글 사이트 정보를 불러오지 못했습니다.');

  const siteMap = new Map([...sites, ...((otherSitesResult.data ?? []) as Site[])].map((site) => [site.id, site]));
  const toPost = (post: Post): PostOption | null => {
    const site = siteMap.get(post.site_id);
    return site
      ? {
          id: post.id,
          subject: post.subject ?? '제목 없음',
          slug: post.slug,
          siteKey: site.site_key,
          siteLabel: site.site_label,
        }
      : null;
  };

  const selections = Object.fromEntries(
    ((selectionsResult.data ?? []) as { selector_type: SelectorType; target_id: string }[])
      .filter((row) => isSelectorType(row.selector_type))
      .map((row) => [row.selector_type, row.target_id]),
  ) as Partial<Record<SelectorType, string>>;

  return {
    features: { ownerLounge: features.has('owner_lounge'), creatorLounge: features.has('creator_lounge') },
    sites: sites.map((site) => ({
      id: site.id,
      siteKey: site.site_key,
      siteLabel: site.site_label,
      siteType: site.site_type,
    })),
    ownPosts: posts
      .filter((post) => ownSiteIds.has(post.site_id))
      .map(toPost)
      .filter(isPostOption),
    otherPosts: posts
      .filter((post) => !ownSiteIds.has(post.site_id))
      .map(toPost)
      .filter(isPostOption),
    selections,
  };
}

export async function GET() {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  try {
    return NextResponse.json(await getSelectorData(currentStigma.stigmaId));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '라운지 노출 대상을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const selectorData = await getSelectorData(currentStigma.stigmaId);
    const values: Partial<Record<SelectorType, string>> = {
      owner_site: toText(body.ownerSiteId),
      creator_site: toText(body.creatorSiteId),
      creator_own_post: toText(body.creatorOwnPostId),
      creator_other_post: toText(body.creatorOtherPostId),
    };
    const allowedIds: Record<SelectorType, Set<string>> = {
      owner_site: new Set(selectorData.sites.map((site) => site.id)),
      creator_site: new Set(selectorData.sites.map((site) => site.id)),
      creator_own_post: new Set(selectorData.ownPosts.map((post) => post.id)),
      creator_other_post: new Set(selectorData.otherPosts.map((post) => post.id)),
    };
    const enabledTypes: SelectorType[] = [
      ...(selectorData.features.ownerLounge ? (['owner_site'] as const) : []),
      ...(selectorData.features.creatorLounge
        ? (['creator_site', 'creator_own_post', 'creator_other_post'] as const)
        : []),
    ];

    for (const type of enabledTypes) {
      if (!values[type]) {
        continue;
      }

      if (!allowedIds[type].has(values[type])) {
        return NextResponse.json({ message: '선택할 수 없는 대상입니다.' }, { status: 400 });
      }
    }

    const supabaseAdmin = getSupabaseAdmin();
    const deleteResult = enabledTypes.length
      ? await supabaseAdmin
          .from('membership_selectors')
          .delete()
          .eq('user_id', currentStigma.stigmaId)
          .in('selector_type', enabledTypes)
      : { error: null };
    if (deleteResult.error) {
      console.error('[Membership Selectors API] Failed to delete old selections:', deleteResult.error);
      throw new Error('라운지 노출 대상을 저장하지 못했습니다. (삭제 실패)');
    }

    const rows = enabledTypes.flatMap((selectorType) =>
      values[selectorType]
        ? [{ user_id: currentStigma.stigmaId, selector_type: selectorType, target_id: values[selectorType] }]
        : [],
    );
    if (rows.length) {
      const insertResult = await supabaseAdmin.from('membership_selectors').insert(rows);
      if (insertResult.error) {
        console.error('[Membership Selectors API] Failed to insert new selections:', insertResult.error);
        throw new Error('라운지 노출 대상을 저장하지 못했습니다. (추가 실패)');
      }
    }

    return NextResponse.json({ message: '라운지 노출 대상을 저장했습니다.' });
  } catch (error) {
    console.error('[Membership Selectors API] PUT Error:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '라운지 노출 대상을 저장하지 못했습니다.' },
      { status: 500 },
    );
  }
}
