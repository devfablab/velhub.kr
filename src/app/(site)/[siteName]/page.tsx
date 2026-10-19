import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getVisibleBlogHomeAds } from '@/lib/blogAds/server';
import { getPostList, type PostListItem } from '@/lib/board/getPostList';
import { getSitePageMetadata } from '@/lib/seoSite';
import { getSupabaseAdmin } from '@/lib/supabase';
import Blog, { type BlogHomeData } from './blog';
import Community from './community';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type BoardType = 'basic' | 'gallery' | 'youtube' | 'feed' | 'page';

type HomeOrderRow = {
  id: string;
  site_id: string;
  board_id: string;
  order: number;
  is_show: boolean;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: BoardType;
  markdown_status: string | null;
  post_type: 'none' | 'prefix' | 'series' | null;
  is_active: boolean;
  sort_order: number | null;
};

type CategoryRow = {
  id: string;
  category_key: string;
  category_label: string;
  summary: string | null;
  thumbnail_image: string | null;
  sort_order: number;
};

type SeriesRow = {
  id: string;
  series_key: string;
  series_label: string;
  summary: string | null;
  thumbnail_image: string | null;
  last_published_at: string | null;
  created_at: string;
  is_completed: boolean;
};

function getBoardContentSize(boardType: BoardType) {
  if (boardType === 'basic') {
    return 10;
  } else if (boardType === 'gallery') {
    return 9;
  }

  return 3;
}

async function getBlogHomeData(siteName: string): Promise<BlogHomeData | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');

  if (!host) {
    return null;
  }

  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const response = await fetch(`${protocol}://${host}/api/site/${encodeURIComponent(siteName)}/blog-home`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<BlogHomeData>;
}

function getBlogHomeImageUrl(bucket: 'category' | 'series', path: string | null) {
  if (!path) {
    return null;
  }

  return getSupabaseAdmin().storage.from(bucket).getPublicUrl(path).data.publicUrl ?? null;
}

function getSiteAvatarUrl(path: string | null) {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return getSupabaseAdmin().storage.from('avatar').getPublicUrl(path).data.publicUrl ?? null;
}

export async function generateMetadata(context: RouteContext) {
  const { siteName } = await context.params;

  return getSitePageMetadata({
    siteName,
    pagePath: '/',
    isMain: true,
  });
}

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = siteName.trim().toLowerCase();

  if (!normalizedSiteName) {
    notFound();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, created_at, site_label, profile_picture, summary, site_type, visibility_type, theme_type, is_shutdown')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    notFound();
  }

  const rhizome = rhizomeResult.data;

  if (rhizome.site_type === 'blog') {
    const [siteResult, blogInfo, blogBoardResult] = await Promise.all([
      supabaseAdmin.from('sites').select('updated_at, updated_by').eq('site_id', rhizome.id).maybeSingle(),
      supabaseAdmin.from('blogs').select('created_at, comment_provider').eq('site_id', rhizome.id).maybeSingle(),
      supabaseAdmin
        .from('boards')
        .select('id, board_key, board_label, board_type, markdown_status, post_type, is_active, sort_order')
        .eq('site_id', rhizome.id)
        .eq('board_key', 'b')
        .eq('board_type', 'blog')
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    if (siteResult.error || !siteResult.data || blogInfo.error || !blogInfo.data || blogBoardResult.error) {
      notFound();
    }

    const sitesInfo = { rhizomes: rhizome, sites: siteResult.data };

    if (blogBoardResult.data === null) {
      return (
        <Blog
          siteName={normalizedSiteName}
          board={null}
          sitesInfo={sitesInfo}
          blogInfo={blogInfo.data}
          hasPublishedPosts={false}
        />
      );
    }

    const blogBoard = blogBoardResult.data as BoardRow;

    const [homeData, postExistsResult, categoriesResult, seriesResult, ads] = await Promise.all([
      getBlogHomeData(normalizedSiteName),
      supabaseAdmin
        .from('posts')
        .select('id')
        .eq('site_id', rhizome.id)
        .eq('board_id', blogBoard.id)
        .eq('is_closed', false)
        .eq('is_wording_blinded', false)
        .eq('published_status', 'published')
        .limit(1),
      supabaseAdmin
        .from('board_categories')
        .select('id, category_key, category_label, summary, thumbnail_image, sort_order')
        .eq('site_id', rhizome.id)
        .order('sort_order', { ascending: true })
        .overrideTypes<CategoryRow[], { merge: false }>(),
      supabaseAdmin
        .from('board_series')
        .select('id, series_key, series_label, summary, thumbnail_image, last_published_at, created_at, is_completed')
        .eq('site_id', rhizome.id)
        .order('last_published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .overrideTypes<SeriesRow[], { merge: false }>(),
      getVisibleBlogHomeAds(rhizome.id),
    ]);

    if (postExistsResult.error || categoriesResult.error || seriesResult.error) {
      notFound();
    }

    const categories = (categoriesResult.data ?? []).map((category) => ({
      id: category.id,
      key: category.category_key,
      label: category.category_label,
      summary: category.summary,
      imageUrl: getBlogHomeImageUrl('category', category.thumbnail_image),
    }));
    const series = (seriesResult.data ?? []).map((seriesItem) => ({
      id: seriesItem.id,
      key: seriesItem.series_key,
      label: seriesItem.series_label,
      summary: seriesItem.summary,
      imageUrl: getBlogHomeImageUrl('series', seriesItem.thumbnail_image),
      publishedAt: seriesItem.last_published_at,
      isCompleted: seriesItem.is_completed,
    }));

    return (
      <Blog
        siteName={normalizedSiteName}
        board={blogBoard}
        sitesInfo={sitesInfo}
        blogInfo={blogInfo.data}
        hasPublishedPosts={(postExistsResult.data ?? []).length > 0}
        homeData={homeData}
        categories={categories}
        series={series}
        ads={ads}
        communityTitle={rhizome.site_label ?? ''}
        communityAvatarUrl={getSiteAvatarUrl(rhizome.profile_picture)}
      />
    );
  }

  if (rhizome.site_type === 'community') {
    const [siteResult, communityInfo, homeOrderResult] = await Promise.all([
      supabaseAdmin.from('sites').select('updated_at, updated_by').eq('site_id', rhizome.id).maybeSingle(),
      supabaseAdmin
        .from('communities')
        .select('created_at, join_type, policy_post, policy_comment')
        .eq('site_id', rhizome.id)
        .maybeSingle(),
      supabaseAdmin
        .from('community_home_orders')
        .select('id, site_id, board_id, order, is_show')
        .eq('site_id', rhizome.id)
        .eq('is_show', true)
        .order('order', { ascending: true }),
    ]);

    if (siteResult.error || !siteResult.data || communityInfo.error || !communityInfo.data || homeOrderResult.error) {
      notFound();
    }

    const sitesInfo = { rhizomes: rhizome, sites: siteResult.data };

    const homeOrders = (homeOrderResult.data ?? []) as HomeOrderRow[];
    const boardIds = homeOrders.map((homeOrder) => homeOrder.board_id);

    let homeBoards: Array<{
      board: BoardRow;
      contents: PostListItem[];
    }> = [];

    if (boardIds.length > 0) {
      const boardResult = await supabaseAdmin
        .from('boards')
        .select('id, board_key, board_label, board_type, markdown_status, post_type, is_active, sort_order')
        .eq('site_id', rhizome.id)
        .eq('is_active', true)
        .in('id', boardIds)
        .neq('board_type', 'page');

      if (boardResult.error) {
        notFound();
      }

      const boardMap = new Map(((boardResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));

      homeBoards = await Promise.all(
        homeOrders
          .map((homeOrder) => boardMap.get(homeOrder.board_id) ?? null)
          .filter((board): board is BoardRow => Boolean(board))
          .map(async (board) => {
            const postList = await getPostList({
              siteId: rhizome.id,
              siteKey: normalizedSiteName,
              siteType: rhizome.site_type,
              boardId: board.id,
              page: 1,
              size: getBoardContentSize(board.board_type),
              filter: 'all',
              sessionCase: 'guest',
              stigmaId: null,
              sort: 'latest',
              includePin: false,
            });

            return {
              board,
              contents: postList.contents,
            };
          }),
      );
    }

    return (
      <Community
        siteName={normalizedSiteName}
        sitesInfo={sitesInfo}
        communityInfo={communityInfo.data}
        homeBoards={homeBoards}
      />
    );
  }

  notFound();
}
