import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import { getCommunityManagerAccess } from '@/lib/community-manager/utils';
import { normalizeText } from '@/lib/utils';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';

type RequestBody = {
  siteName: string | null;
  email: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getInviteMailFrom() {
  const inviteMailFrom = process.env.RESEND_FROM_EMAIL!;

  if (!inviteMailFrom) {
    throw new Error('초대 메일 발신 주소가 설정되지 않았습니다.');
  }

  return inviteMailFrom;
}

function getResendClient() {
  const resendApiKey = process.env.RESEND_API_KEY!;

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY가 설정되지 않았습니다.');
  }

  return new Resend(resendApiKey);
}

async function sendInviteEmail(params: {
  email: string;
  siteName: string;
  siteLabel: string | null;
  token: string;
  appUrl: string;
}) {
  const resend = getResendClient();
  const from = getInviteMailFrom();
  const appUrl = params.appUrl;
  const inviteUrl = `${appUrl}/${params.siteName}/invite-community/${params.token}`;
  const siteLabel = params.siteLabel?.trim() || params.siteName;

  await resend.emails.send({
    from,
    to: params.email,
    subject: `[${siteLabel}] 커뮤니티 초대`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="margin: 0 0 16px;">커뮤니티 초대</h2>
        <p style="margin: 0 0 8px;">사이트명: ${siteLabel}</p>
        <p style="margin: 0 0 8px;">역할: 멤버</p>
        <p style="margin: 0 0 16px;">유효시간: 24시간</p>
        <p style="margin: 0 0 16px;">
          <a href="${inviteUrl}" target="_blank" rel="noreferrer">초대 링크 열기</a>
        </p>
        <p style="margin: 0;">링크가 열리지 않으면 아래 주소를 복사해서 사용해주세요.</p>
        <p style="margin: 8px 0 0; word-break: break-all;">${inviteUrl}</p>
      </div>
    `,
  });
}

async function checkAccess(siteName: string) {
  try {
    const access = await getCommunityManagerAccess(siteName);

    if (!access.actor.permissions.join_manage) {
      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } as const;
    }

    const siteLabelResult = await access.supabaseAdmin
      .from('rhizomes')
      .select('site_label')
      .eq('id', access.rhizome.id)
      .maybeSingle();

    if (siteLabelResult.error) {
      return {
        ok: false,
        status: 500,
        error: '사이트 정보를 불러오지 못했습니다.',
      } as const;
    }

    return {
      ok: true,
      status: 200,
      siteId: access.rhizome.id,
      siteKey: access.rhizome.site_key,
      siteLabel: (siteLabelResult.data?.site_label ?? null) as string | null,
      actor: access.actor,
      supabaseAdmin: access.supabaseAdmin,
    } as const;
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return {
        ok: false,
        status: 403,
        error: unknownError.message || '접근 권한이 없습니다.',
      } as const;
    }

    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }
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

    const nowIsoString = new Date().toISOString();
    const sevenDaysAgoIsoString = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const expireInvite = await access.supabaseAdmin
      .from('invite')
      .update({
        status: 'expired',
      })
      .eq('site_id', access.siteId)
      .eq('role', 'member')
      .eq('status', 'pending')
      .lt('expires_at', nowIsoString);

    if (expireInvite.error) {
      return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const deleteExpiredInvite = await access.supabaseAdmin
      .from('invite')
      .delete()
      .eq('site_id', access.siteId)
      .eq('role', 'member')
      .eq('status', 'expired')
      .lt('expires_at', sevenDaysAgoIsoString);

    if (deleteExpiredInvite.error) {
      return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const invite = await access.supabaseAdmin
      .from('invite')
      .select('id, email, role, status, expires_at, accepted_user_id, joined_at, cancelled_at')
      .eq('site_id', access.siteId)
      .eq('role', 'member')
      .order('created_at', { ascending: false });

    if (invite.error) {
      return Response.json({ error: invite.error.message || '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      invites: invite.data ?? [],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const email = normalizeEmail(requestBody.email);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!email) {
      return Response.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return Response.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const particleResult = await access.supabaseAdmin.from('particles').select('id').eq('email', email).maybeSingle();

    if (particleResult.error) {
      return Response.json({ error: '회원 정보 확인에 실패했습니다.' }, { status: 500 });
    }

    if (particleResult.data) {
      const stigmaResult = await access.supabaseAdmin
        .from('stigmas')
        .select('id')
        .eq('user_id', particleResult.data.id)
        .maybeSingle();

      if (stigmaResult.error) {
        return Response.json({ error: '회원 정보 확인에 실패했습니다.' }, { status: 500 });
      }

      if (stigmaResult.data) {
        const membershipResult = await access.supabaseAdmin
          .from('rhizome_stigmas')
          .select('id')
          .eq('site_id', access.siteId)
          .eq('user_id', stigmaResult.data.id)
          .maybeSingle();

        if (membershipResult.error) {
          return Response.json({ error: '가입 정보 확인에 실패했습니다.' }, { status: 500 });
        }

        if (membershipResult.data) {
          return Response.json({ error: '이미 가입한 멤버입니다.' }, { status: 400 });
        }
      }
    }

    const duplicatePendingInvite = await access.supabaseAdmin
      .from('invite')
      .select('id')
      .eq('site_id', access.siteId)
      .eq('email', email)
      .eq('role', 'member')
      .eq('status', 'pending')
      .maybeSingle();

    if (duplicatePendingInvite.error) {
      return Response.json(
        { error: duplicatePendingInvite.error.message || '초대 정보 확인에 실패했습니다.' },
        { status: 500 },
      );
    }

    if (duplicatePendingInvite.data) {
      return Response.json({ error: '이미 초대장을 받은 대상자입니다.' }, { status: 400 });
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const invite = await access.supabaseAdmin
      .from('invite')
      .insert({
        site_id: access.siteId,
        email,
        role: 'member',
        status: 'pending',
        token,
        expires_at: expiresAt,
        accepted_user_id: null,
        joined_at: null,
        cancelled_at: null,
      })
      .select('id, email, role, status, expires_at, accepted_user_id, joined_at, cancelled_at')
      .maybeSingle();

    if (invite.error || !invite.data) {
      return Response.json({ error: invite.error?.message || '초대를 실패했습니다.' }, { status: 500 });
    }

    const appUrl = request.nextUrl.origin;

    try {
      await sendInviteEmail({
        email,
        siteName: access.siteKey,
        siteLabel: access.siteLabel,
        token,
        appUrl,
      });
    } catch (unknownError) {
      await access.supabaseAdmin.from('invite').delete().eq('id', invite.data.id);

      if (unknownError instanceof Error) {
        return Response.json({ error: unknownError.message || '초대 메일 발송에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({ error: '초대 메일 발송에 실패했습니다.' }, { status: 500 });
    }

    const invitedUserResult = await access.supabaseAdmin
      .from('particles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (invitedUserResult.error) {
      console.error(invitedUserResult.error);
    }

    if (invitedUserResult.data?.id) {
      const notificationResult = await access.supabaseAdmin.from('notifications').insert({
        user_id: invitedUserResult.data.id,
        send_user_id: null,
        send_site_id: access.siteId,
        send_board_id: null,
        send_series_id: null,
        send_post_id: null,
        notification_type: NOTIFICATION_TYPE.COMMUNITY_MEMBER_INVITATION_SENT,
        is_read: false,
      });

      if (notificationResult.error) {
        console.error(notificationResult.error);
      }
    }

    return Response.json({
      ok: true,
      invite: invite.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '초대를 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '초대를 실패했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const requestBody = (await request.json()) as {
      siteName: string | null;
      inviteId: string | null;
    };

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const inviteId = normalizeText(requestBody.inviteId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!inviteId) {
      return Response.json({ error: 'inviteId가 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const invite = await access.supabaseAdmin
      .from('invite')
      .select('id, status')
      .eq('id', inviteId)
      .eq('site_id', access.siteId)
      .eq('role', 'member')
      .maybeSingle();

    if (invite.error || !invite.data) {
      return Response.json({ error: '초대 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (invite.data.status !== 'pending') {
      return Response.json({ error: '대기 중인 초대만 취소할 수 있습니다.' }, { status: 400 });
    }

    const cancelInvite = await access.supabaseAdmin
      .from('invite')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', inviteId)
      .eq('site_id', access.siteId)
      .select('id, email, role, status, expires_at, accepted_user_id, joined_at, cancelled_at')
      .maybeSingle();

    if (cancelInvite.error || !cancelInvite.data) {
      return Response.json({ error: '초대 취소에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      invite: cancelInvite.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '초대 취소에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '초대 취소에 실패했습니다.' }, { status: 500 });
  }
}
