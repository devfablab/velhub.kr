import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type SiteRow = {
  id: string;
  profile_picture: string | null;
  profile_logo: string | null;
  site_type: string;
  site_label: string | null;
  created_at: string;
};

type AccountRow = {
  user_name: string;
};

function decryptValue(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return null;
  }
}

function getPublicStorageUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrlResult = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrlResult.data.publicUrl || null;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, profile_picture, profile_logo, site_type, site_label, created_at')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;

    const session = await verifySession({ siteId: site.id });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const ownerMembershipResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('user_id')
      .eq('site_id', site.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (ownerMembershipResult.error) {
      return Response.json({ error: '운영자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    let ownerName: string | null = null;

    if (ownerMembershipResult.data?.user_id) {
      const ownerAccountResult = await supabaseAdmin
        .from('stigmas')
        .select('user_name')
        .eq('id', ownerMembershipResult.data.user_id)
        .maybeSingle();

      if (ownerAccountResult.error) {
        return Response.json({ error: '운영자 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      const ownerAccount = ownerAccountResult.data as AccountRow | null;
      ownerName = decryptValue(ownerAccount?.user_name);
    }

    const memberCountResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', site.id)
      .eq('is_approval', true);

    if (memberCountResult.error) {
      return Response.json({ error: '통계 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const postCountResult = await supabaseAdmin
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', site.id);

    if (postCountResult.error) {
      return Response.json({ error: '통계 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      site: {
        avatar: getPublicStorageUrl('avatar', site.profile_picture),
        logo: getPublicStorageUrl('site-logo', site.profile_logo),
        name: site.site_label ?? null,
        createdAt: site.created_at ?? null,
        siteType: site.site_type,
        ownerName,
      },
      stats: {
        memberCount: memberCountResult.count ?? 0,
        postCount: postCountResult.count ?? 0,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
