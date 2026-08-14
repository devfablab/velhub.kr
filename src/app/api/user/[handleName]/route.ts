import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption/decrypt';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getMembershipFeatures } from '@/lib/memberships/features';

function getAvatarUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return getSupabaseAdmin().storage.from('avatar').getPublicUrl(path).data.publicUrl ?? null;
}

function decryptUserName(value: string) {
  const text = normalizeText(value);
  if (!text) return null;
  try {
    const decrypted = decrypt(text);
    return decrypted.startsWith('naver_') ? null : decrypted;
  } catch {
    return null;
  }
}

export async function GET(_: Request, context: { params: Promise<{ handleName: string }> }) {
  const { handleName } = await context.params;
  const normalizedHandleName = handleName.trim().toLowerCase();
  const supabaseAdmin = getSupabaseAdmin();
  const profileResult = await supabaseAdmin
    .from('users')
    .select('id, user_id, handle_name, cover_image, introduction')
    .eq('handle_name', normalizedHandleName)
    .maybeSingle();
  if (profileResult.error) return NextResponse.json({ message: '독자 프로필을 불러오지 못했습니다.' }, { status: 500 });
  if (!profileResult.data) return NextResponse.json({ message: '독자 프로필을 찾을 수 없습니다.' }, { status: 404 });

  const page = Math.max(1, Number(new URL(_.url).searchParams.get('page') ?? '1') || 1);
  const from = (page - 1) * 100;
  const creator = profileResult.data;

  const [currentStigma, stigmaResult, seriesResult, features] = await Promise.all([
    getCurrentStigma(),
    supabaseAdmin.from('stigmas').select('user_name, avatar').eq('id', creator.user_id).maybeSingle(),
    supabaseAdmin.from('board_series').select('id, series_label').eq('user_id', creator.user_id),
    getMembershipFeatures(creator.user_id),
  ]);

  if (!features.has('affetto_my_posts')) {
    return NextResponse.json({ message: '개인사정으로 인해 운영이 중단되었습니다.' }, { status: 403 });
  }

  if (stigmaResult.error || seriesResult.error)
    return NextResponse.json({ message: '독자 정보를 불러오지 못했습니다.' }, { status: 500 });

  const series = seriesResult.data ?? [];
  const postsResult = await supabaseAdmin
    .from('posts')
    .select('id, site_id, board_id, series_id, subject, slug, published_at', { count: 'exact' })
    .eq('user_id', creator.user_id)
    .eq('published_status', 'published')
    .eq('is_closed', false)
    .order('published_at', { ascending: false })
    .range(from, from + 99);

  if (postsResult.error) return NextResponse.json({ message: '내가 쓴 글을 불러오지 못했습니다.' }, { status: 500 });

  const posts = postsResult.data ?? [];
  const [sitesResult, boardsResult] = await Promise.all([
    posts.length
      ? supabaseAdmin
          .from('rhizomes')
          .select('id, site_key, site_label')
          .in('id', [...new Set(posts.map((post) => post.site_id))])
      : { data: [], error: null },
    posts.length
      ? supabaseAdmin
          .from('boards')
          .select('id, board_key')
          .in('id', [...new Set(posts.map((post) => post.board_id))])
      : { data: [], error: null },
  ]);
  if (sitesResult.error || boardsResult.error)
    return NextResponse.json({ message: '연재글 경로를 불러오지 못했습니다.' }, { status: 500 });
  const siteMap = new Map(
    (sitesResult.data ?? []).map((site) => [site.id, { key: site.site_key, label: site.site_label }]),
  );
  const boardMap = new Map((boardsResult.data ?? []).map((board) => [board.id, board.board_key]));
  const seriesMap = new Map(series.map((item) => [item.id, item.series_label]));

  return NextResponse.json({
    user: {
      handleName: creator.handle_name,
      coverImage: creator.cover_image,
      introduction: creator.introduction,
      activityName: decryptUserName(stigmaResult.data?.user_name ?? '') ?? '독자',
      profileImage: getAvatarUrl(stigmaResult.data?.avatar ?? null),
    },
    posts: posts.map((post) => ({
      id: post.id,
      subject: post.subject ?? '제목 없음',
      publishedAt: post.published_at,
      seriesLabel: seriesMap.get(post.series_id) ?? '연재',
      siteLabel: siteMap.get(post.site_id)?.label ?? '사이트',
      url: `/${siteMap.get(post.site_id)?.key ?? ''}/${boardMap.get(post.board_id) ?? ''}/${post.slug ?? ''}`,
    })),
    total: postsResult.count ?? 0,
    page,
    isOwner: currentStigma?.stigmaId === creator.user_id,
  });
}
