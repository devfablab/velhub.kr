import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

async function getUpdatedByName(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  siteId: string,
  particleId: string,
) {
  const nickname = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('nickname')
    .eq('site_id', siteId)
    .eq('user_id', particleId)
    .maybeSingle();

  if (nickname.data?.nickname) {
    return nickname.data.nickname;
  }

  const stigmaUser = await supabaseAdmin.from('stigmas').select('user_name').eq('user_id', particleId).maybeSingle();

  if (stigmaUser.data?.user_name) {
    return decrypt(stigmaUser.data.user_name);
  }

  return '';
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select(
        'id, created_at, site_key, site_label, profile_picture, profile_logo, summary, site_type, visibility_type, theme_type, is_shutdown',
      )
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'blog') {
      return Response.json({ error: '블로그 정보를 불러올 수 없습니다.' }, { status: 400 });
    }

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      const session = await verifySession({
        siteId: rhizome.data.id,
      });

      if (session.case !== 'staff') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const sites = await supabaseAdmin
      .from('sites')
      .select('updated_at, updated_by, log')
      .eq('site_id', rhizome.data.id)
      .maybeSingle();

    if (sites.error || !sites.data) {
      return Response.json({ error: 'sites 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const updatedByName = sites.data.updated_by
      ? await getUpdatedByName(supabaseAdmin, rhizome.data.id, sites.data.updated_by)
      : '';

    const rawProfilePicture = normalizeText(rhizome.data.profile_picture);
    let profilePictureUrl = '';

    if (rawProfilePicture) {
      const publicUrl = supabaseAdmin.storage.from('avatar').getPublicUrl(rawProfilePicture);
      profilePictureUrl = publicUrl.data.publicUrl ?? '';
    }

    const rawProfileLogo = normalizeText(rhizome.data.profile_logo);
    let profileLogoUrl = '';

    if (rawProfileLogo) {
      const publicUrl = supabaseAdmin.storage.from('site-logo').getPublicUrl(rawProfileLogo);
      profileLogoUrl = publicUrl.data.publicUrl ?? '';
    }

    return Response.json({
      siteInfo: rhizome.data,
      profilePictureUrl,
      profileLogoUrl,
      sites: {
        updated_at: sites.data.updated_at,
        updated_by: sites.data.updated_by,
        updated_by_name: updatedByName,
        log: sites.data.log ?? '사이트 개설',
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '블로그 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '블로그 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
