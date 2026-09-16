import { getPrivateBoardAccess, getPrivateBoardSiteName } from '@/lib/private-board/access';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteName = getPrivateBoardSiteName(requestUrl.searchParams.get('siteName'));
  const filter = requestUrl.searchParams.get('filter');
  const page = Math.max(1, Number(requestUrl.searchParams.get('page')) || 1);

  if (!siteName) return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });

  const access = await getPrivateBoardAccess(siteName);
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  let query = access.supabaseAdmin
    .from('private_posts')
    .select('id, category_id, author_stigma_id, subject, answered_at, created_at', { count: 'exact' })
    .eq('site_id', access.site.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (!access.isStaff) query = query.eq('author_stigma_id', access.stigmaId);
  if (access.isStaff && filter === 'unanswered') query = query.is('answered_at', null);
  if (access.isStaff && filter === 'answered') query = query.not('answered_at', 'is', null);

  const posts = await query;
  if (posts.error) return Response.json({ error: '글 목록을 불러오지 못했습니다.' }, { status: 500 });

  const rows = posts.data ?? [];
  const authorIds = [...new Set(rows.map((post) => post.author_stigma_id))];
  const [categories, authorStigmas] = await Promise.all([
    access.supabaseAdmin
      .from('private_board_categories')
      .select('id, category_label')
      .eq('private_board_id', access.board.id)
      .order('sort_order'),
    authorIds.length ? access.supabaseAdmin.from('stigmas').select('id, user_id').in('id', authorIds) : { data: [] },
  ]);

  const authorUserIds = [...new Set((authorStigmas.data ?? []).map((stigma) => stigma.user_id))];
  const [users, creators] = await Promise.all([
    authorUserIds.length
      ? access.supabaseAdmin.from('users').select('user_id, handle_name').in('user_id', authorUserIds)
      : { data: [] },
    authorUserIds.length
      ? access.supabaseAdmin.from('creators').select('user_id, handle_name').in('user_id', authorUserIds)
      : { data: [] },
  ]);

  const nicknames = authorIds.length
    ? await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('user_id, nickname')
        .eq('site_id', access.site.id)
        .in('user_id', authorIds)
    : { data: [] };

  if (categories.error) {
    return Response.json({ error: '카테고리를 불러오지 못했습니다.' }, { status: 500 });
  }

  const categoryMap = new Map((categories.data ?? []).map((category) => [category.id, category.category_label]));
  const handleByUserId = new Map(
    [...(users.data ?? []), ...(creators.data ?? [])].map((profile) => [profile.user_id, profile.handle_name]),
  );
  const handleMap = new Map(
    (authorStigmas.data ?? []).map((stigma) => [stigma.id, handleByUserId.get(stigma.user_id)]),
  );
  const nicknameMap = new Map((nicknames.data ?? []).map((member) => [member.user_id, member.nickname]));

  return Response.json({
    board: access.board,
    categories: (categories.data ?? []).map((category) => ({ id: category.id, label: category.category_label })),
    isStaff: access.isStaff,
    page,
    pageSize: PAGE_SIZE,
    total: posts.count ?? 0,
    posts: rows.map((post) => ({
      id: post.id,
      categoryLabel: categoryMap.get(post.category_id) ?? '분류없음',
      subject: post.subject,
      authorName: nicknameMap.get(post.author_stigma_id) || handleMap.get(post.author_stigma_id) || '알 수 없음',
      hasAnswer: Boolean(post.answered_at),
      createdAt: post.created_at,
    })),
  });
}
