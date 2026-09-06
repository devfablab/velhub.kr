import { notFound } from 'next/navigation';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { Chip } from '@mui/material';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { getSeriesPageMetadata } from '@/lib/seoSite';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import SiteProfile from '@/components/service/blog/SiteProfile';
import DonationButton from '@/components/service/common/DonationButton';
import SubscriptionButton from '@/components/service/common/SubscriptionButton';
import { ServiceNoDataIcon } from '@/components/Svgs';
import Container from '../../menu';
import styles from '@/app/board.module.sass';

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
  } | null;
};

type PostRow = {
  id: string;
  slug: number;
  subject: string;
  summary: string | null;
  thumbnail_image: string | null;
  created_at: string;
  published_at: string | null;
  published_status: 'draft' | 'published';
  post_count: number | null;
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

const PAGE_SIZE = 10;

function getPageNumber(value: string | undefined) {
  const pageNumber = Number(value);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return 1;
  }

  return pageNumber;
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
          board_label
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
  const posts = await supabaseAdmin
    .from('posts')
    .select(
      `
        id,
        slug,
        subject,
        summary,
        created_at,
        published_at,
        published_status,
        post_count,
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
    (permanentPurchaseResult.data ?? [])
      .map((payment) => normalizeText(payment.target_id))
      .filter(Boolean),
  );
  const visiblePosts = allPosts.filter(
    (post) => post.is_closed === false || permanentlyOwnedPostIds.has(post.id),
  );
  const from = (currentPage - 1) * PAGE_SIZE;
  const contents = visiblePosts.slice(from, from + PAGE_SIZE);
  const totalCount = visiblePosts.length;
  const totalPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <Container pageBack={`/${siteName}/s`} pageTitle={seriesData.series_label}>
      <div className="container">
        <div className={`content ${styles['blog-list']} ${styles.content}`}>
          <SiteProfile />
          <div className={styles.headline}>
            <div className={styles['series-info']}>
              <h2>{seriesData.series_label}</h2>
              {seriesData.is_completed ? <Chip label="완결" size="small" className={styles.em} /> : null}
            </div>
            {seriesData.summary ? <p>{seriesData.summary}</p> : null}
            {seriesData.boards ? (
              <div className={styles['series-actions']}>
                <SubscriptionButton
                  siteName={normalizedSiteName}
                  boardName={seriesData.boards.board_key}
                  board={{
                    id: seriesData.board_id,
                    board_key: seriesData.boards.board_key,
                    board_label: seriesData.boards.board_label,
                  }}
                  selectedSeries={{
                    series_key: seriesData.series_key,
                    series_label: seriesData.series_label,
                  }}
                  selectedBoard
                  isEnabledByServer={isSeriesSubscriptionEnabled}
                />
                <DonationButton
                  siteName={normalizedSiteName}
                  targetType="series"
                  boardName={seriesData.boards.board_key}
                  seriesName={seriesData.series_key}
                  buttonText="연재 후원"
                />
              </div>
            ) : null}
          </div>

          <div className="paper">
            {contents.length > 0 ? (
              <div className={styles['blog-items']}>
                {contents.map((content) => (
                  <Anchor
                    href={`/${normalizedSiteName}/${content.boards?.board_key}/${content.slug}?seriesName=${seriesData.series_key}`}
                    key={content.id}
                  >
                    <div className={styles.thumbnail}>
                      <span>{content.published_status === 'draft' ? <em>(임시글)</em> : null}</span>
                      {content.thumbnail_image ? (
                        <img src={content.thumbnail_image} alt="" />
                      ) : (
                        <div className={styles.dummy}>
                          <MenuBookRoundedIcon />
                        </div>
                      )}
                    </div>
                    <div className={styles.info}>
                      <div className={styles.subject}>
                        <strong>{content.subject}</strong>
                        {content.is_closed ? <em>삭제된 연재글</em> : null}
                      </div>
                    </div>
                  </Anchor>
                ))}
              </div>
            ) : (
              <div className="paper page-info">
                <ServiceNoDataIcon />
                <p>등록된 글이 없습니다.</p>
              </div>
            )}

            {totalPage > 1 ? (
              <nav>
                {currentPage > 1 ? (
                  <Anchor href={`/${normalizedSiteName}/s/${normalizedSeriesName}?page=${currentPage - 1}`}>
                    이전
                  </Anchor>
                ) : null}

                <span>
                  {currentPage} / {totalPage}
                </span>

                {currentPage < totalPage ? (
                  <Anchor href={`/${normalizedSiteName}/s/${normalizedSeriesName}?page=${currentPage + 1}`}>
                    다음
                  </Anchor>
                ) : null}
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </Container>
  );
}
