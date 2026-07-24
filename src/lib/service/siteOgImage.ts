import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export const SITE_OG_BUCKET = 'site-og';
export const MAX_SITE_OG_FILE_SIZE = 1024 * 1024;
export const SITE_OG_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function getSiteOgAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  if (rhizome.data.site_type === 'community') {
    try {
      const access = await getCommunityManagerAccess(siteName);

      if (!access.actor.permissions.site_edit) {
        return {
          ok: false,
          status: 403,
          error: '접근 권한이 없습니다.',
        } as const;
      }
    } catch {
      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } as const;
    }
  } else {
    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.case !== 'staff' || !session.rhizomeStigmaId) {
      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } as const;
    }

    const membership = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('id', session.rhizomeStigmaId)
      .eq('site_id', rhizome.data.id)
      .maybeSingle();

    if (membership.error || normalizeText(membership.data?.role) !== 'owner') {
      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } as const;
    }
  }

  return {
    ok: true,
    status: 200,
    siteId: rhizome.data.id as string,
    supabaseAdmin,
  } as const;
}
