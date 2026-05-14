import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type MemberGeneralRow = {
  id: string;
  created_at: string;
  name_ko: string | null;
  name_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  start_work_date: string | null;
  job: string | null;
  member_id: string;
  site_id: string;
};

type TeamMemberRow = {
  id: string;
  nickname: string | null;
};

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

function attachMemberInfo<T extends { member_id: string }>(
  rows: T[],
  teamMemberMap: Map<string, string>,
  rhizomeStigmaId: string | null | undefined,
) {
  return rows.map((row) => ({
    ...row,
    nickname: teamMemberMap.get(row.member_id) ?? '',
    isMine: rhizomeStigmaId === row.member_id,
  }));
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

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (session.case !== 'staff') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const [sites, memberGeneral, memberEducations, memberAwards, memberProjects, memberCareers] = await Promise.all([
      supabaseAdmin.from('sites').select('updated_at, updated_by, log').eq('site_id', rhizome.data.id).maybeSingle(),
      supabaseAdmin
        .from('member_general')
        .select(
          'id, created_at, name_ko, name_en, description_ko, description_en, start_work_date, job, member_id, site_id',
        )
        .eq('site_id', rhizome.data.id)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('member_educations')
        .select('id, created_at, school, major, start_date, end_date, member_id, site_id, sort_order')
        .eq('site_id', rhizome.data.id)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('member_awards')
        .select('id, created_at, subject, institution, date_time, member_id, site_id, sort_order')
        .eq('site_id', rhizome.data.id)
        .order('sort_order', { ascending: false }),
      supabaseAdmin
        .from('member_projects')
        .select(
          'id, created_at, work_start_date, work_end_date, subject, description, client, agency, site_name, site_url, member_id, site_id, sort_order',
        )
        .eq('site_id', rhizome.data.id)
        .order('sort_order', { ascending: false }),
      supabaseAdmin
        .from('member_careers')
        .select(
          'id, created_at, organization, team_position, role_job, work_start_date, work_end_date, member_id, site_id, sort_order',
        )
        .eq('site_id', rhizome.data.id)
        .order('sort_order', { ascending: false }),
    ]);

    if (sites.error || !sites.data) {
      return Response.json({ error: 'sites 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (
      memberGeneral.error ||
      memberEducations.error ||
      memberAwards.error ||
      memberProjects.error ||
      memberCareers.error
    ) {
      return Response.json({ error: '팀원 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const memberIds = Array.from(
      new Set(
        [
          ...(memberGeneral.data ?? []).map((row) => row.member_id),
          ...(memberEducations.data ?? []).map((row) => row.member_id),
          ...(memberAwards.data ?? []).map((row) => row.member_id),
          ...(memberProjects.data ?? []).map((row) => row.member_id),
          ...(memberCareers.data ?? []).map((row) => row.member_id),
        ].filter(Boolean),
      ),
    );

    const teamMembers =
      memberIds.length > 0
        ? await supabaseAdmin
            .from('rhizome_stigmas')
            .select('id, nickname')
            .eq('site_id', rhizome.data.id)
            .in('id', memberIds)
        : { data: [], error: null };

    if (teamMembers.error) {
      return Response.json({ error: '팀원 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const teamMemberMap = new Map(
      ((teamMembers.data ?? []) as TeamMemberRow[]).map((member) => [member.id, member.nickname ?? '']),
    );

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
      memberGeneral: attachMemberInfo(
        (memberGeneral.data ?? []) as MemberGeneralRow[],
        teamMemberMap,
        session.rhizomeStigmaId,
      ),
      memberEducations: attachMemberInfo(memberEducations.data ?? [], teamMemberMap, session.rhizomeStigmaId),
      memberAwards: attachMemberInfo(memberAwards.data ?? [], teamMemberMap, session.rhizomeStigmaId),
      memberProjects: attachMemberInfo(memberProjects.data ?? [], teamMemberMap, session.rhizomeStigmaId),
      memberCareers: attachMemberInfo(memberCareers.data ?? [], teamMemberMap, session.rhizomeStigmaId),
      canEditMyMemberGeneral: Boolean(
        session.rhizomeStigmaId && (session.case === 'staff' || session.case === 'member'),
      ),
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
