import { notFound } from 'next/navigation';
import { decrypt } from '@/lib/encryption/decrypt';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { getSeriesPageMetadata } from '@/lib/seoSite';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import type { DonationStatusResponse } from '@/components/service/common/DonationButton';
import type { SubscriptionStatusResponse } from '@/components/service/common/SubscriptionButton';
import { getSiteApiData } from '../../../getSiteApiData';
import Container from '../../menu';
import Opt, { type SeriesContentItem } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
    seriesName: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
};

type SeriesRow = {
  id: string;
  created_at: string;
  series_key: string;
  series_label: string;
  summary: string | null;
  thumbnail_image: string | null;
  board_id: string;
  site_id: string;
  last_published_at: string | null;
  is_completed: boolean;
  is_subscription: boolean | null;
  user_id: string | null;
  boards: {
    board_key: string;
    board_label: string;
    board_type: 'basic' | 'gallery' | 'blog';
  } | null;
};

type PostRow = {
  id: string;
  slug: number;
  subject: string;
  summary: string | null;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  images: unknown;
  created_at: string;
  published_at: string | null;
  published_status: 'draft' | 'published';
  post_count: number | null;
  user_id: string;
  series_idx: number | null;
  is_pin: boolean;
  board_id: string;
  site_id: string;
  series_id: string | null;
  idx: number;
  is_closed: boolean;
  boards: {
    board_key: string;
    board_label: string;
  } | null;
};

type PostImageRow = {
  path?: string | null;
  url?: string | null;
  width?: number | null;
  height?: number | null;
};

type StigmaRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
};

type MembershipRow = {
  user_id: string;
  nickname: string | null;
};

const PAGE_SIZE = 10;

function getPageNumber(value: string | undefined) {
  const pageNumber = Number(value);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return 1;
  }

  return pageNumber;
}

function getPublicPostImageUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) return '';
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;

  const supabaseAdmin = getSupabaseAdmin();
  const bucket = normalizedPath.includes('/') ? 'post' : 'og-image';

  return supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath).data.publicUrl ?? '';
}

function normalizePostImages(value: unknown) {
  if (!Array.isArray(value)) return [];

  return (value as PostImageRow[])
    .map((image) => {
      const path = normalizeText(image.path);
      const url = normalizeText(image.url) || getPublicPostImageUrl(path);

      if (!url) return null;

      return {
        url,
        width: typeof image.width === 'number' ? image.width : null,
        height: typeof image.height === 'number' ? image.height : null,
      };
    })
    .filter((image): image is { url: string; width: number | null; height: number | null } => Boolean(image));
}

async function getAuthorNameMap(siteId: string, userIds: string[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const uniqueUserIds = Array.from(new Set(userIds.map((userId) => normalizeText(userId)).filter(Boolean)));
  const authorMap = new Map<string, string>();

  if (uniqueUserIds.length === 0) return authorMap;

  const [stigmasByIdResult, stigmasByAuthResult] = await Promise.all([
    supabaseAdmin.from('stigmas').select('id, user_id, user_name').in('id', uniqueUserIds),
    supabaseAdmin.from('stigmas').select('id, user_id, user_name').in('user_id', uniqueUserIds),
  ]);
  const stigmaRows = [
    ...((stigmasByIdResult.data ?? []) as StigmaRow[]),
    ...((stigmasByAuthResult.data ?? []) as StigmaRow[]),
  ];
  const stigmaIds = Array.from(new Set(stigmaRows.map((stigma) => stigma.id).filter(Boolean)));
  const membershipResult =
    stigmaIds.length > 0
      ? await supabaseAdmin
          .from('rhizome_stigmas')
          .select('user_id, nickname')
          .eq('site_id', siteId)
          .in('user_id', stigmaIds)
      : { data: [], error: null };
  const membershipMap = new Map(
    ((membershipResult.data ?? []) as MembershipRow[]).map((membership) => [
      membership.user_id,
      normalizeText(membership.nickname),
    ]),
  );

  uniqueUserIds.forEach((userId) => {
    const stigma = stigmaRows.find((row) => row.id === userId || row.user_id === userId);
    const nickname = stigma ? membershipMap.get(stigma.id) : '';

    if (nickname) {
      authorMap.set(userId, nickname);
      return;
    }

    if (stigma?.user_name) {
      try {
        authorMap.set(userId, decrypt(stigma.user_name));
      } catch {
        authorMap.set(userId, '');
      }
    }
  });

  return authorMap;
}

export async function generateMetadata(context: RouteContext) {
  const { siteName, seriesName } = await context.params;

  return getSeriesPageMetadata({
    siteName,
    seriesName,
    pagePath: `/s/${seriesName}`,
  });
}

export default async function Page(context: RouteContext) {
  const { siteName, seriesName } = await context.params;
  const searchParams = await context.searchParams;

  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedSeriesName = normalizeText(seriesName).toLowerCase();
  const currentPage = getPageNumber(searchParams.page);

  if (!normalizedSiteName || !normalizedSeriesName) {
    notFound();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type, visibility_type, is_shutdown')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizome.error || !rhizome.data) {
    notFound();
  }

  const isCommunity = rhizome.data.site_type === 'community';

  const series = await supabaseAdmin
    .from('board_series')
    .select(
      `
        id,
        created_at,
        series_key,
        series_label,
        summary,
        thumbnail_image,
        board_id,
        site_id,
        last_published_at,
        is_completed,
        is_subscription,
        user_id,
        boards (
          board_key,
          board_label,
          board_type
        )
      `,
    )
    .eq('site_id', rhizome.data.id)
    .eq('series_key', normalizedSeriesName)
    .maybeSingle()
    .overrideTypes<SeriesRow, { merge: false }>();

  if (series.error || !series.data) {
    notFound();
  }

  const seriesData = series.data as SeriesRow;
  const seriesSubscriptionSetting = await supabaseAdmin
    .from('subscription_settings')
    .select('is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', seriesData.id)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES)
    .maybeSingle();
  const isSeriesSubscriptionEnabled =
    seriesData.is_subscription === true && seriesSubscriptionSetting.data?.is_enabled === true;
  const initialSubscriptionStatus = seriesData.boards
    ? await getSiteApiData<SubscriptionStatusResponse>(
        `/api/payments/portone/subscriptions/status?${new URLSearchParams({
          siteName: normalizedSiteName,
          boardName: seriesData.boards.board_key,
          targetType: 'series',
          seriesName: seriesData.series_key,
        }).toString()}`,
        '구독 상태를 확인하지 못했습니다.',
      )
    : { data: null, error: '' };
  const initialDonationStatus = seriesData.boards
    ? await getSiteApiData<DonationStatusResponse>(
        `/api/payments/portone/donation/status?${new URLSearchParams({
          siteName: normalizedSiteName,
          boardName: seriesData.boards.board_key,
          targetType: 'series',
          seriesName: seriesData.series_key,
        }).toString()}`,
        '후원 상태를 확인하지 못했습니다.',
      )
    : { data: null, error: '' };
  const posts = await supabaseAdmin
    .from('posts')
    .select(
      `
        id,
        slug,
        subject,
        summary,
        thumbnail_image,
        thumbnail_width,
        thumbnail_height,
        images,
        created_at,
        published_at,
        published_status,
        post_count,
        user_id,
        series_idx,
        is_pin,
        board_id,
        site_id,
        series_id,
        idx,
        is_closed,
        boards (
          board_key,
          board_label
        )
      `,
    )
    .eq('site_id', rhizome.data.id)
    .eq('series_id', seriesData.id)
    .eq('published_status', 'published')
    .order('idx', { ascending: false })
    .overrideTypes<PostRow[], { merge: false }>();

  if (posts.error) {
    notFound();
  }

  const allPosts = (posts.data ?? []) as PostRow[];
  const session = await verifySession({ siteId: rhizome.data.id });
  const closedPostIds = allPosts.filter((post) => post.is_closed === true).map((post) => post.id);
  const permanentPurchaseResult =
    session.stigmaId && closedPostIds.length > 0
      ? await supabaseAdmin
          .from('payments')
          .select('target_id')
          .eq('buyer_user_id', session.stigmaId)
          .eq('payment_type', PAYMENT_TYPE.PURCHASE_POST)
          .eq('target_type', PAYMENT_TARGET_TYPE.POST)
          .eq('status', PAYMENT_STATUS.PAID)
          .in('target_id', closedPostIds)
      : { data: [], error: null };

  if (permanentPurchaseResult.error) {
    notFound();
  }

  const permanentlyOwnedPostIds = new Set(
    (permanentPurchaseResult.data ?? []).map((payment) => normalizeText(payment.target_id)).filter(Boolean),
  );
  const visiblePosts = allPosts.filter((post) => post.is_closed === false || permanentlyOwnedPostIds.has(post.id));
  const from = (currentPage - 1) * PAGE_SIZE;
  const pagePosts = visiblePosts.slice(from, from + PAGE_SIZE);
  const pagePostIds = pagePosts.map((post) => post.id);
  const [authorMap, commentsResult] = await Promise.all([
    getAuthorNameMap(
      rhizome.data.id,
      pagePosts.map((post) => post.user_id),
    ),
    pagePostIds.length > 0
      ? supabaseAdmin
          .from('post_comments')
          .select('post_id')
          .eq('site_id', rhizome.data.id)
          .eq('board_id', seriesData.board_id)
          .in('post_id', pagePostIds)
          .eq('is_deleted', false)
          .eq('is_blinded', false)
      : { data: [], error: null },
  ]);

  if (commentsResult.error) {
    notFound();
  }

  const commentCountMap = new Map<string, number>();

  (commentsResult.data ?? []).forEach((comment) => {
    commentCountMap.set(comment.post_id, (commentCountMap.get(comment.post_id) ?? 0) + 1);
  });

  const contents: SeriesContentItem[] = pagePosts.map((post) => ({
    id: post.id,
    slug: String(post.slug),
    subject: post.subject,
    summary: normalizeText(post.summary),
    created_at: post.created_at,
    published_at: post.published_at,
    published_status: post.published_status,
    post_count: Number(post.post_count ?? 0),
    series_idx: post.series_idx,
    is_pin: post.is_pin === true,
    is_closed: post.is_closed,
    author_name: authorMap.get(post.user_id) ?? '',
    comment_count: commentCountMap.get(post.id) ?? 0,
    thumbnail_image_url: getPublicPostImageUrl(post.thumbnail_image) || null,
    thumbnail_width: post.thumbnail_width ?? 1200,
    thumbnail_height: post.thumbnail_height ?? 675,
    images: normalizePostImages(post.images),
  }));
  const totalCount = visiblePosts.length;
  const totalPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <Container pageBack={`/${siteName}/s`} pageTitle={seriesData.series_label}>
      {seriesData.boards ? (
        <Opt
          siteName={normalizedSiteName}
          boardId={seriesData.board_id}
          boardName={seriesData.boards.board_key}
          boardLabel={seriesData.boards.board_label}
          boardType={seriesData.boards.board_type}
          seriesName={seriesData.series_key}
          seriesLabel={seriesData.series_label}
          summary={seriesData.summary}
          isCompleted={seriesData.is_completed}
          isCommunity={isCommunity}
          isSubscriptionEnabled={isSeriesSubscriptionEnabled}
          initialSubscriptionStatus={initialSubscriptionStatus.data}
          initialDonationStatus={initialDonationStatus.data}
          contents={contents}
          currentPage={currentPage}
          totalPage={totalPage}
        />
      ) : null}
    </Container>
  );
}
