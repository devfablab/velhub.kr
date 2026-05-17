import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type MembershipRow = {
  id: string;
  site_id: string;
  created_at: string;
  nickname: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  is_approval: boolean | null;
};

type RhizomeRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
  profile_picture: string | null;
  profile_logo: string | null;
};

function getPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? null;
}

function getSiteTypeLabel(siteType: string) {
  if (siteType === 'community') {
    return '커뮤니티';
  }

  if (siteType === 'blog') {
    return '블로그';
  }

  return siteType;
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({
        joins: [],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error) {
      return Response.json({ error: '가입 신청 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!stigmaResult.data?.id) {
      return Response.json({
        joins: [],
      });
    }

    const membershipResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, site_id, created_at, nickname, rejected_at, rejected_by, is_approval')
      .eq('user_id', stigmaResult.data.id)
      .eq('is_approval', false)
      .is('rejected_at', null)
      .is('rejected_by', null)
      .order('created_at', { ascending: false });

    if (membershipResult.error) {
      return Response.json({ error: '가입 신청 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const membershipRows = (membershipResult.data ?? []) as MembershipRow[];

    if (membershipRows.length === 0) {
      return Response.json({
        joins: [],
      });
    }

    const siteIds = [...new Set(membershipRows.map((membership) => membership.site_id).filter(Boolean))];

    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, site_type, profile_picture, profile_logo')
      .eq('site_type', 'community')
      .in('id', siteIds);

    if (rhizomeResult.error) {
      return Response.json({ error: '가입 신청 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const rhizomeMap = new Map<string, RhizomeRow>(
      ((rhizomeResult.data ?? []) as RhizomeRow[]).map((rhizome) => [rhizome.id, rhizome]),
    );

    const joins = membershipRows
      .map((membership) => {
        const rhizome = rhizomeMap.get(membership.site_id);

        if (!rhizome) {
          return null;
        }

        const siteName = normalizeText(rhizome.site_key);

        if (!siteName) {
          return null;
        }

        return {
          id: membership.id,
          siteName,
          siteLabel: normalizeText(rhizome.site_label) || siteName,
          siteType: rhizome.site_type,
          siteTypeLabel: getSiteTypeLabel(rhizome.site_type),
          nickname: normalizeText(membership.nickname),
          requestedAt: membership.created_at,
          href: `/${siteName}`,
          profilePictureUrl: getPublicUrl('avatar', rhizome.profile_picture),
          profileLogoUrl: getPublicUrl('site-logo', rhizome.profile_logo),
        };
      })
      .filter(
        (
          join,
        ): join is {
          id: string;
          siteName: string;
          siteLabel: string;
          siteType: string;
          siteTypeLabel: string;
          nickname: string;
          requestedAt: string;
          href: string;
          profilePictureUrl: string | null;
          profileLogoUrl: string | null;
        } => Boolean(join),
      );

    return Response.json({
      joins,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '가입 신청 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '가입 신청 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
