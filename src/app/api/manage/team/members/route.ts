import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';

type RequestBody = {
  siteName: string | null;
  teamId: string | null;
  isBlock?: boolean | null;
  role?: 'manager' | 'member' | 'observer' | null;
};

function isChangeableRole(value: string): value is 'manager' | 'member' | 'observer' {
  return value === 'manager' || value === 'member' || value === 'observer';
}

function isAllowedRoleChange(currentRole: string, nextRole: 'manager' | 'member' | 'observer') {
  return (
    (currentRole === 'manager' && nextRole === 'member') ||
    (currentRole === 'member' && (nextRole === 'manager' || nextRole === 'observer')) ||
    (currentRole === 'observer' && nextRole === 'member')
  );
}

async function checkAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  if (rhizome.data.site_type !== 'blog') {
    return {
      ok: false,
      status: 403,
      error: '블로그 사이트만 접근할 수 있습니다.',
    } as const;
  }

  const session = await verifySession({
    siteId: rhizome.data.id,
  });

  if (session.case !== 'staff') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  return {
    ok: true,
    status: 200,
    siteId: rhizome.data.id,
    session,
    supabaseAdmin,
  } as const;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const team = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, user_id, nickname, role, is_block, blocked_at, block_count, approval_at')
      .eq('site_id', access.siteId)
      .order('approval_at', { ascending: true });

    if (team.error) {
      return Response.json({ error: '팀블로그 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmaIdList = Array.from(new Set((team.data ?? []).map((item) => item.user_id).filter(Boolean)));

    const stigmas = stigmaIdList.length
      ? await access.supabaseAdmin.from('stigmas').select('id, user_id, email, user_name').in('id', stigmaIdList)
      : { data: [], error: null };

    if (stigmas.error) {
      return Response.json({ error: '팀블로그 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmaMap = new Map(
      (stigmas.data ?? []).map((item) => [
        item.id,
        {
          authUserId: item.user_id as string | null,
          email: item.email ? decrypt(item.email as string) : '',
          userName: (item.user_name as string | null) ?? '',
        },
      ]),
    );

    return Response.json({
      teams: (team.data ?? []).map((item) => {
        const stigma = stigmaMap.get(item.user_id as string);

        return {
          id: item.id,
          email: stigma?.email ?? '',
          name: item.nickname || (stigma?.userName ? decrypt(stigma.userName) : ''),
          approval_at: item.approval_at,
          role: item.role,
          is_block: item.is_block,
          blocked_at: item.is_block ? item.blocked_at : null,
          block_count: Number(item.block_count ?? 0),
          is_self: item.user_id === access.session.stigmaId,
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '팀블로그 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '팀블로그 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const teamId = normalizeText(requestBody.teamId);
    const isBlock = requestBody.isBlock;
    const role = normalizeText(requestBody.role);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!teamId) {
      return Response.json({ error: 'teamId가 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const team = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, user_id, is_block, blocked_at, block_count, role')
      .eq('id', teamId)
      .eq('site_id', access.siteId)
      .maybeSingle();

    if (team.error || !team.data) {
      return Response.json({ error: '팀블로그 사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (team.data.user_id === access.session.stigmaId) {
      return Response.json({ error: '본인 정보는 변경할 수 없습니다.' }, { status: 403 });
    }

    if (role) {
      if (!isChangeableRole(role)) {
        return Response.json({ error: '역할 값이 올바르지 않습니다.' }, { status: 400 });
      }

      if (team.data.role === 'owner') {
        return Response.json({ error: '운영자 역할은 변경할 수 없습니다.' }, { status: 403 });
      }

      if (team.data.role === role) {
        return Response.json({ error: '이미 같은 역할입니다.' }, { status: 400 });
      }

      if (!isAllowedRoleChange(normalizeText(team.data.role), role)) {
        return Response.json({ error: '허용되지 않은 역할 변경입니다.' }, { status: 400 });
      }

      const updateTeam = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .update({
          role,
        })
        .eq('id', teamId)
        .eq('site_id', access.siteId)
        .select('id, role, is_block, blocked_at, block_count')
        .maybeSingle();

      if (updateTeam.error || !updateTeam.data) {
        return Response.json({ error: '역할 변경에 실패했습니다.' }, { status: 500 });
      }

      const stigmaIds = [...new Set([team.data.user_id, access.session.stigmaId])];

      const stigmaResult = await access.supabaseAdmin.from('stigmas').select('id, user_id').in('id', stigmaIds);

      if (stigmaResult.error) {
        console.error(stigmaResult.error);
      } else {
        const particleIdMap = new Map((stigmaResult.data ?? []).map((stigma) => [stigma.id, stigma.user_id]));

        const userId = particleIdMap.get(team.data.user_id);

        if (userId && team.data.role !== 'observer') {
          const notificationType =
            role === 'manager'
              ? NOTIFICATION_TYPE.BLOG_MEMBER_PROMOTED_TO_MANAGER
              : role === 'observer'
                ? NOTIFICATION_TYPE.BLOG_MEMBER_CHANGED_TO_OBSERVER
                : NOTIFICATION_TYPE.BLOG_MANAGER_CHANGED_TO_MEMBER;
          const notificationResult = await access.supabaseAdmin.from('notifications').insert({
            user_id: userId,
            send_user_id: particleIdMap.get(access.session.stigmaId) ?? null,
            send_site_id: access.siteId,
            send_board_id: null,
            send_series_id: null,
            send_post_id: null,
            notification_type: notificationType,
            is_read: false,
          });

          if (notificationResult.error) {
            console.error(notificationResult.error);
          }
        }
      }

      return Response.json({
        ok: true,
        team: updateTeam.data,
      });
    }

    if (typeof isBlock !== 'boolean') {
      return Response.json({ error: '차단 여부 값이 올바르지 않습니다.' }, { status: 400 });
    }

    const nextBlockCount =
      isBlock && team.data.is_block !== true
        ? Number(team.data.block_count ?? 0) + 1
        : Number(team.data.block_count ?? 0);

    const updateTeam = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        is_block: isBlock,
        blocked_at: isBlock ? new Date().toISOString() : null,
        block_count: nextBlockCount,
      })
      .eq('id', teamId)
      .eq('site_id', access.siteId)
      .select('id, role, is_block, blocked_at, block_count')
      .maybeSingle();

    if (updateTeam.error || !updateTeam.data) {
      return Response.json({ error: '차단 상태 변경에 실패했습니다.' }, { status: 500 });
    }

    const stigmaIds = [...new Set([team.data.user_id, access.session.stigmaId])];

    const stigmaResult = await access.supabaseAdmin.from('stigmas').select('id, user_id').in('id', stigmaIds);

    if (stigmaResult.error) {
      console.error(stigmaResult.error);
    } else {
      const particleIdMap = new Map((stigmaResult.data ?? []).map((stigma) => [stigma.id, stigma.user_id]));

      const userId = particleIdMap.get(team.data.user_id);

      if (userId) {
        const notificationResult = await access.supabaseAdmin.from('notifications').insert({
          user_id: userId,
          send_user_id: particleIdMap.get(access.session.stigmaId) ?? null,
          send_site_id: access.siteId,
          send_board_id: null,
          send_series_id: null,
          send_post_id: null,
          notification_type: isBlock ? NOTIFICATION_TYPE.SITE_MEMBER_BLOCKED : NOTIFICATION_TYPE.SITE_MEMBER_UNBLOCKED,
          is_read: false,
        });

        if (notificationResult.error) {
          console.error(notificationResult.error);
        }
      }
    }

    return Response.json({
      ok: true,
      team: updateTeam.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '팀원 정보 변경에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '팀원 정보 변경에 실패했습니다.' }, { status: 500 });
  }
}
