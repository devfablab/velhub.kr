import { notFound } from 'next/navigation';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import SiteProfile from '@/components/service/blog/SiteProfile';
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

  if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
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
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

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
        boards (
          board_key,
          board_label
        )
      `,
      { count: 'exact' },
    )
    .eq('site_id', rhizome.data.id)
    .eq('series_id', seriesData.id)
    .eq('published_status', 'published')
    .eq('is_closed', false)
    .order('idx', { ascending: false })
    .range(from, to)
    .overrideTypes<PostRow[], { merge: false }>();

  if (posts.error) {
    notFound();
  }

  const contents = (posts.data ?? []) as PostRow[];
  const totalCount = posts.count ?? 0;
  const totalPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <Container pageBack={`/${siteName}/s`} pageTitle={seriesData.series_label}>
      <div className="container">
        <div className={`content ${styles['blog-list']} ${styles.content}`}>
          <SiteProfile />
          <div className={styles.headline}>
            <h2>{seriesData.series_label}</h2>
            {seriesData.is_completed ? <em>완결</em> : null}
            {seriesData.summary ? <p>{seriesData.summary}</p> : null}
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
                      </div>
                    </div>
                  </Anchor>
                ))}
              </div>
            ) : (
              <p>등록된 글이 없습니다.</p>
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
