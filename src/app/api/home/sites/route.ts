import { type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RhizomeRow = {
  site_key: string;
  site_label: string;
  profile_picture: string | null;
  summary: string | null;
  site_type: string;
  created_at: string;
  profile_logo: string | null;
  member_count: number | null;
  post_count: number | null;
};

function getPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
    return normalizedPath;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const sortBy = searchParams.get('sortBy') ?? 'created_at';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';
    const limitParam = searchParams.get('limit') ?? '10';
    const siteType = searchParams.get('siteType');

    const ascending = sortOrder === 'asc';
    const limit = parseInt(limitParam, 10);

    const supabaseAdmin = getSupabaseAdmin();

    let query = supabaseAdmin
      .from('rhizomes')
      .select(
        'site_key, site_label, profile_picture, summary, site_type, profile_logo, member_count, post_count, created_at',
      )
      .eq('visibility_type', 'public')
      .eq('is_shutdown', false)
      .eq('is_blocked', false);

    if (siteType === 'blog' || siteType === 'community') {
      query = query.eq('site_type', siteType);
    }

    const { data, error } = await query.order(sortBy, { ascending }).limit(limit);

    if (error || !data) {
      return Response.json({ error: '사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (data as RhizomeRow[]).map((site) => ({
      site_key: site.site_key,
      site_label: site.site_label,
      profile_picture: getPublicUrl('profile_picture', site.profile_picture),
      summary: site.summary,
      site_type: site.site_type,
      profile_logo: getPublicUrl('profile_logo', site.profile_logo),
      created_at: site.created_at,
      member_count: site.member_count,
      post_count: site.post_count,
    }));

    return Response.json({ sites });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
