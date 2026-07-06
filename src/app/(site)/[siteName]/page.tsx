import { notFound } from 'next/navigation';
import { getPostList, type PostListItem } from '@/lib/board/getPostList';
import { getSupabaseAdmin } from '@/lib/supabase';
import Blog from './blog';
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

function getBoardContentSize(boardType: BoardType) {
  if (boardType === 'basic') {
    return 10;
  } else if (boardType === 'gallery') {
    return 9;
  }

  return 3;
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
    .select(
      'id, created_at, site_label, profile_picture, summary, site_type, plan_type, visibility_type, theme_type, is_shutdown',
    )
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    notFound();
  }

  const rhizome = rhizomeResult.data;

  const siteResult = await supabaseAdmin
    .from('sites')
    .select('updated_at, updated_by')
    .eq('site_id', rhizome.id)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    notFound();
  }

  const sitesInfo = {
    rhizomes: rhizome,
    sites: siteResult.data,
  };

  if (rhizome.site_type === 'blog') {
    const blogInfo = await supabaseAdmin
      .from('blogs')
      .select('created_at, comment_provider')
      .eq('site_id', rhizome.id)
      .maybeSingle();

    if (blogInfo.error || !blogInfo.data) {
      notFound();
    }

    const blogBoardResult = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, markdown_status, post_type, is_active, sort_order')
      .eq('site_id', rhizome.id)
      .eq('is_active', true)
      .neq('board_type', 'page')
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (blogBoardResult.error) {
      notFound();
    }

    if (blogBoardResult.data === null) {
      return (
        <Blog
          siteName={normalizedSiteName}
          board={null}
          sitesInfo={sitesInfo}
          blogInfo={blogInfo.data}
          blogContents={null}
        />
      );
    }

    const blogBoard = blogBoardResult.data as BoardRow;

    const blogPostList = await getPostList({
      siteId: rhizome.id,
      siteKey: normalizedSiteName,
      boardId: blogBoard.id,
      page: 1,
      size: 10,
      filter: 'all',
      sessionCase: 'guest',
      authUserId: null,
      sort: 'latest',
      includePin: false,
    });

    const blogContents: PostListItem[] = blogPostList.contents;

    return (
      <Blog
        siteName={normalizedSiteName}
        board={blogBoard}
        sitesInfo={sitesInfo}
        blogInfo={blogInfo.data}
        blogContents={blogContents}
      />
    );
  }

  if (rhizome.site_type === 'community') {
    const communityInfo = await supabaseAdmin
      .from('communities')
      .select('created_at, join_type, policy_post, policy_comment')
      .eq('site_id', rhizome.id)
      .maybeSingle();

    if (communityInfo.error || !communityInfo.data) {
      notFound();
    }

    const homeOrderResult = await supabaseAdmin
      .from('community_home_orders')
      .select('id, site_id, board_id, order, is_show')
      .eq('site_id', rhizome.id)
      .eq('is_show', true)
      .order('order', { ascending: true });

    if (homeOrderResult.error) {
      notFound();
    }

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
              boardId: board.id,
              page: 1,
              size: getBoardContentSize(board.board_type),
              filter: 'all',
              sessionCase: 'guest',
              authUserId: null,
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
