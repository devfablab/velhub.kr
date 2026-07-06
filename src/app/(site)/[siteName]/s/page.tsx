import { notFound } from 'next/navigation';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatTimeAgo, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import SiteProfile from '@/components/service/blog/SiteProfile';
import Container from '../menu';
import styles from '@/app/board.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
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

function getSeriesImageUrl(path: string | null) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from('series').getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? '';
}

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
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
    .order('last_published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .overrideTypes<SeriesRow[], { merge: false }>();

  if (series.error) {
    notFound();
  }

  const rows = (series.data ?? []) as SeriesRow[];

  return (
    <Container pageBack={`/${siteName}`} pageTitle="연재물">
      <div className="container">
        <div className={`content ${styles['blog-list']} ${styles.content}`}>
          <SiteProfile />
          <div className="paper">
            {rows.length > 0 ? (
              <div className={`${styles['series-items']} ${styles['blog-items']}`}>
                {rows.map((item) => {
                  const imageUrl = getSeriesImageUrl(item.thumbnail_image);
                  return (
                    <Anchor href={`/${normalizedSiteName}/s/${item.series_key}`} key={item.id}>
                      <div className={styles.thumbnail}>
                        {imageUrl ? (
                          <img src={imageUrl} alt="" />
                        ) : (
                          <div className={styles.dummy}>
                            <MenuBookRoundedIcon />
                          </div>
                        )}
                      </div>
                      <div className={styles.info}>
                        <strong>{item.series_label}</strong>
                        {item.is_completed ? <em>완결</em> : null}
                        {item.summary ? <p>{item.summary}</p> : null}
                        {item.last_published_at ? <time>{formatTimeAgo(item.last_published_at)}</time> : null}
                      </div>
                    </Anchor>
                  );
                })}
              </div>
            ) : (
              <p>연재글이 없습니다. 😭</p>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
