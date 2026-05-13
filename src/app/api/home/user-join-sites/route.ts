import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RhizomeStigmaRow = {
  site_id: string;
  role: string | null;
};

type RhizomeRow = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  profile_picture: string | null;
};

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({
        isLoggedIn: false,
        role: null,
        joinSites: [],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id, role')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const joinSitesResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('site_id, role')
      .eq('user_id', stigmaResult.data.id);

    if (joinSitesResult.error) {
      return Response.json({ error: '가입한 사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const joinSiteRows = (joinSitesResult.data ?? []) as RhizomeStigmaRow[];
    const siteIdList = Array.from(new Set(joinSiteRows.map((row) => row.site_id).filter(Boolean)));

    if (siteIdList.length === 0) {
      return Response.json({
        isLoggedIn: true,
        role: stigmaResult.data.role ?? null,
        joinSites: [],
      });
    }

    const rhizomesResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, site_type, profile_picture')
      .in('id', siteIdList);

    if (rhizomesResult.error) {
      return Response.json({ error: '가입한 사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const rhizomeMap = new Map(
      ((rhizomesResult.data ?? []) as RhizomeRow[]).map((row) => [
        row.id,
        {
          id: row.id,
          site_key: normalizeText(row.site_key),
          site_label: normalizeText(row.site_label),
          site_type: normalizeText(row.site_type).toLowerCase(),
          avatar: row.profile_picture ?? null,
        },
      ]),
    );

    const joinSites = joinSiteRows
      .map((row) => {
        const rhizome = rhizomeMap.get(row.site_id);

        if (!rhizome) {
          return null;
        }

        return {
          id: rhizome.id,
          site_key: rhizome.site_key,
          site_label: rhizome.site_label,
          site_type: rhizome.site_type,
          avatar: rhizome.avatar,
          role: normalizeText(row.role).toLowerCase(),
        };
      })
      .filter(
        (
          row,
        ): row is {
          id: string;
          site_key: string;
          site_label: string;
          site_type: string;
          avatar: string | null;
          role: string;
        } => Boolean(row && row.id && row.site_key && row.site_label),
      );

    return Response.json({
      isLoggedIn: true,
      role: stigmaResult.data.role ?? null,
      joinSites,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
