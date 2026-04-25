import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
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
      .eq('role', 'member')
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

    if (rhizome.data.site_type !== 'community') {
      return Response.json({ error: '커뮤니티 사이트만 접근할 수 있습니다.' }, { status: 403 });
    }

    if (rhizome.data.site_key !== siteName) {
      return Response.json({ error: '초대장 정보가 올바르지 않습니다.' }, { status: 403 });
    }

    const community = await supabaseAdmin
      .from('communities')
      .select('join_notice')
      .eq('site_id', rhizome.data.id)
      .maybeSingle();

    if (community.error) {
      return Response.json({ error: '커뮤니티 정보를 불러오지 못했습니다.' }, { status: 500 });
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
      joinNotice: community.data?.join_notice ?? '',
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
      .eq('role', 'member')
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
      .select('id, site_key, site_type, is_shutdown')
      .eq('id', invite.data.site_id)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'community') {
      return Response.json({ error: '커뮤니티 사이트만 접근할 수 있습니다.' }, { status: 403 });
    }

    if (rhizome.data.site_key !== siteName) {
      return Response.json({ error: '초대장 정보가 올바르지 않습니다.' }, { status: 403 });
    }

    if (rhizome.data.is_shutdown) {
      return Response.json({ error: '현재 가입할 수 없습니다.' }, { status: 403 });
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
    const finalNickname = nickname || fallbackNickname || null;

    const currentRhizomeStigma = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id')
      .eq('site_id', invite.data.site_id)
      .eq('user_id', stigma.data.id)
      .maybeSingle();

    console.log('currentRhizomeStigma: ', currentRhizomeStigma);

    if (currentRhizomeStigma.error) {
      return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
    }

    const approvalAt = new Date().toISOString();

    if (currentRhizomeStigma.data) {
      const updateRhizomeStigma = await supabaseAdmin
        .from('rhizome_stigmas')
        .update({
          role: 'member',
          is_approval: true,
          approval_at: approvalAt,
          is_block: false,
          block_count: 0,
          nickname: finalNickname,
          post_count: 0,
          comment_count: 0,
          checkin_count: 0,
          last_visit_at: approvalAt,
        })
        .eq('id', currentRhizomeStigma.data.id);

      if (updateRhizomeStigma.error) {
        return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
      }
    } else {
      const insertRhizomeStigma = await supabaseAdmin
        .from('rhizome_stigmas')
        .insert({
          site_id: invite.data.site_id,
          user_id: stigma.data.id,
          role: 'member',
          is_approval: true,
          approval_at: approvalAt,
          is_block: false,
          block_count: 0,
          blocked_at: null,
          nickname: finalNickname,
          post_count: 0,
          comment_count: 0,
          checkin_count: 0,
          last_visit_at: approvalAt,
          answered_questions: [],
          staff_note: null,
          handled_by: null,
          handled_at: null,
        })
        .select('id')
        .maybeSingle();

      if (insertRhizomeStigma.error || !insertRhizomeStigma.data) {
        return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
      }
    }

    const updateInvite = await supabaseAdmin
      .from('invite')
      .update({
        status: 'joined',
        accepted_user_id: stigma.data.id,
        joined_at: approvalAt,
      })
      .eq('id', invite.data.id);

    if (updateInvite.error) {
      return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
    }

    const deleteInvite = await supabaseAdmin.from('invite').delete().eq('id', invite.data.id);

    if (deleteInvite.error) {
      return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      siteName: rhizome.data.site_key,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '초대 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '초대 처리에 실패했습니다.' }, { status: 500 });
  }
}
