import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function isExpired(value: string | null) {
  if (!value) {
    return true;
  }

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) {
    return true;
  }

  return time < Date.now();
}

async function getNextAutoNickname(params: { siteId: string; stigmaId: string; baseNickname: string }) {
  const { siteId, stigmaId, baseNickname } = params;
  const supabaseAdmin = getSupabaseAdmin();

  const exactResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, nickname, user_id')
    .eq('site_id', siteId)
    .eq('nickname', baseNickname);

  if (exactResult.error) {
    throw new Error('닉네임을 확인하지 못했습니다.');
  }

  const hasExactDuplicate = (exactResult.data ?? []).some((row) => row.user_id !== stigmaId);

  if (!hasExactDuplicate) {
    return baseNickname;
  }

  const likeResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('nickname, user_id')
    .eq('site_id', siteId)
    .like('nickname', `${baseNickname}%`);

  if (likeResult.error) {
    throw new Error('닉네임을 확인하지 못했습니다.');
  }

  const usedNicknameSet = new Set(
    (likeResult.data ?? [])
      .filter((row) => row.user_id !== stigmaId)
      .map((row) => normalizeText(row.nickname))
      .filter(Boolean),
  );

  let nextNumber = 2;

  while (usedNicknameSet.has(`${baseNickname}${nextNumber}`)) {
    nextNumber += 1;
  }

  return `${baseNickname}${nextNumber}`;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const normalizedToken = normalizeText(token);
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!normalizedToken) {
      return Response.json({ error: 'token이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const invite = await supabaseAdmin
      .from('invite')
      .select('id, site_id, email, role, status, expires_at, accepted_user_id, joined_at, cancelled_at')
      .eq('token', normalizedToken)
      .maybeSingle();

    if (invite.error || !invite.data) {
      return Response.json({ error: '초대장을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (invite.data.status === 'cancelled') {
      return Response.json({ error: '취소된 초대장입니다.' }, { status: 400 });
    }

    if (invite.data.status === 'expired' || isExpired(invite.data.expires_at)) {
      if (invite.data.status !== 'expired') {
        await supabaseAdmin
          .from('invite')
          .update({
            status: 'expired',
          })
          .eq('id', invite.data.id);
      }

      return Response.json({ error: '만료된 초대장입니다.' }, { status: 400 });
    }

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, site_type')
      .eq('id', invite.data.site_id)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'blog') {
      return Response.json({ error: '블로그 사이트만 접근할 수 있습니다.' }, { status: 403 });
    }

    if (rhizome.data.site_key !== siteName) {
      return Response.json({ error: '초대장 정보가 올바르지 않습니다.' }, { status: 403 });
    }

    const sessionClaims = await getSessionClaims();

    let isLoggedIn = false;
    let isInvitedUser = false;
    let isAlreadyMember = false;

    if (sessionClaims?.userId) {
      isLoggedIn = true;

      const stigma = await supabaseAdmin
        .from('stigmas')
        .select('id, email')
        .eq('user_id', sessionClaims.userId)
        .maybeSingle();

      if (stigma.error) {
        return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
      }

      const currentEmail = stigma.data?.email ? decrypt(stigma.data.email) : '';

      if (currentEmail && currentEmail.trim().toLowerCase() === invite.data.email.trim().toLowerCase()) {
        isInvitedUser = true;
      }

      if (stigma.data?.id) {
        const existingMember = await supabaseAdmin
          .from('rhizome_stigmas')
          .select('id')
          .eq('site_id', rhizome.data.id)
          .eq('user_id', stigma.data.id)
          .limit(1)
          .maybeSingle();

        isAlreadyMember = Boolean(existingMember.data);
      }
    }

    return Response.json({
      ok: true,
      invite: {
        id: invite.data.id,
        email: invite.data.email,
        role: invite.data.role,
        status: invite.data.status,
        expires_at: invite.data.expires_at,
      },
      site: {
        id: rhizome.data.id,
        site_key: rhizome.data.site_key,
        site_label: rhizome.data.site_label,
        site_type: rhizome.data.site_type,
      },
      isLoggedIn,
      isInvitedUser,
      isAlreadyMember,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '초대장을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '초대장을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { token } = await context.params;
    const normalizedToken = normalizeText(token);
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const requestBody = (await request.json()) as {
      nickname?: string | null;
    };
    const nickname = normalizeText(requestBody.nickname);

    if (!normalizedToken) {
      return Response.json({ error: 'token이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const invite = await supabaseAdmin
      .from('invite')
      .select('id, site_id, email, role, status, expires_at')
      .eq('token', normalizedToken)
      .maybeSingle();

    if (invite.error || !invite.data) {
      return Response.json({ error: '초대장을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (invite.data.status === 'cancelled') {
      return Response.json({ error: '취소된 초대장입니다.' }, { status: 400 });
    }

    if (invite.data.status === 'expired' || isExpired(invite.data.expires_at)) {
      if (invite.data.status !== 'expired') {
        await supabaseAdmin
          .from('invite')
          .update({
            status: 'expired',
          })
          .eq('id', invite.data.id);
      }

      return Response.json({ error: '만료된 초대장입니다.' }, { status: 400 });
    }

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key')
      .eq('id', invite.data.site_id)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_key !== siteName) {
      return Response.json({ error: '초대장 정보가 올바르지 않습니다.' }, { status: 403 });
    }

    const stigma = await supabaseAdmin
      .from('stigmas')
      .select('id, email, user_name')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigma.error || !stigma.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const currentEmail = stigma.data.email ? decrypt(stigma.data.email) : '';

    if (!currentEmail || currentEmail.trim().toLowerCase() !== invite.data.email.trim().toLowerCase()) {
      return Response.json({ error: '초대받은 이메일과 현재 계정 이메일이 일치하지 않습니다.' }, { status: 403 });
    }

    const fallbackNickname = stigma.data.user_name ? decrypt(stigma.data.user_name) : '';
    const isAutoNickname = !nickname;
    let finalNickname = nickname || fallbackNickname || null;

    if (finalNickname) {
      if (isAutoNickname) {
        try {
          finalNickname = await getNextAutoNickname({
            siteId: invite.data.site_id,
            stigmaId: stigma.data.id,
            baseNickname: finalNickname,
          });
        } catch (error) {
          if (error instanceof Error) {
            return Response.json({ error: error.message }, { status: 500 });
          }

          return Response.json({ error: '닉네임을 확인하지 못했습니다.' }, { status: 500 });
        }
      } else {
        const duplicateNicknameResult = await supabaseAdmin
          .from('rhizome_stigmas')
          .select('id')
          .eq('site_id', invite.data.site_id)
          .eq('nickname', finalNickname)
          .neq('user_id', stigma.data.id)
          .limit(1)
          .maybeSingle();

        if (duplicateNicknameResult.error) {
          return Response.json({ error: '닉네임을 확인하지 못했습니다.' }, { status: 500 });
        }

        if (duplicateNicknameResult.data) {
          return Response.json({ error: '이미 사용 중인 닉네임입니다.' }, { status: 400 });
        }
      }
    }

    const currentRhizomeStigma = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, is_approval')
      .eq('site_id', invite.data.site_id)
      .eq('user_id', stigma.data.id)
      .maybeSingle();

    let acceptedUserId = '';
    const joinedAt = new Date().toISOString();

    if (currentRhizomeStigma.error) {
      return Response.json({ error: '초대 처리에 실패했습니다.1' }, { status: 500 });
    }

    if (currentRhizomeStigma.data) {
      acceptedUserId = currentRhizomeStigma.data.id;

      const updateRhizomeStigma = await supabaseAdmin
        .from('rhizome_stigmas')
        .update({
          role: invite.data.role,
          is_approval: true,
          approval_at: joinedAt,
          is_block: false,
          block_count: 0,
          nickname: finalNickname,
          last_checkin_at: joinedAt,
        })
        .eq('id', currentRhizomeStigma.data.id);

      if (updateRhizomeStigma.error) {
        return Response.json({ error: '초대 처리에 실패했습니다.2' }, { status: 500 });
      }
    } else {
      const insertRhizomeStigma = await supabaseAdmin
        .from('rhizome_stigmas')
        .insert({
          site_id: invite.data.site_id,
          user_id: stigma.data.id,
          role: invite.data.role,
          is_approval: true,
          approval_at: joinedAt,
          is_block: false,
          block_count: 0,
          blocked_at: null,
          nickname: finalNickname,
          post_count: 0,
          comment_count: 0,
          checkin_count: 0,
          last_checkin_at: joinedAt,
          answered_questions: [],
          staff_note: null,
          handled_by: null,
          handled_at: null,
        })
        .select('id')
        .maybeSingle();

      if (insertRhizomeStigma.error || !insertRhizomeStigma.data) {
        return Response.json({ error: '초대 처리에 실패했습니다.3' }, { status: 500 });
      }

      acceptedUserId = insertRhizomeStigma.data.id;
    }

    const updateInvite = await supabaseAdmin
      .from('invite')
      .update({
        status: 'joined',
        accepted_user_id: acceptedUserId,
        joined_at: joinedAt,
      })
      .eq('id', invite.data.id);

    if (updateInvite.error) {
      return Response.json({ error: '초대 처리에 실패했습니다.4' }, { status: 500 });
    }

    const deleteInvite = await supabaseAdmin.from('invite').delete().eq('id', invite.data.id);

    if (deleteInvite.error) {
      return Response.json({ error: '초대 처리에 실패했습니다.5' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      siteName: rhizome.data.site_key,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '초대 처리에 실패했습니다.6' }, { status: 500 });
    }

    return Response.json({ error: '초대 처리에 실패했습니다.7' }, { status: 500 });
  }
}
