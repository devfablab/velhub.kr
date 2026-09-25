import { notFound } from 'next/navigation';
import { getSitePageMetadata } from '@/lib/seoSite';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Container from '../menu';
import Opt, { type SeriesItem } from './opt';

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

export async function generateMetadata(context: RouteContext) {
  const { siteName } = await context.params;

  return getSitePageMetadata({
    siteName,
    pageTitle: '연재물',
    pagePath: '/s',
  });
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

  const rows: SeriesItem[] = ((series.data ?? []) as SeriesRow[]).map((item) => ({
    id: item.id,
    series_key: item.series_key,
    series_label: item.series_label,
    summary: item.summary,
    imageUrl: getSeriesImageUrl(item.thumbnail_image),
    last_published_at: item.last_published_at,
    is_completed: item.is_completed,
  }));

  return (
    <Container pageBack={`/${siteName}`} pageTitle="연재물">
      <Opt siteName={normalizedSiteName} isCommunity={isCommunity} rows={rows} />
    </Container>
  );
}
