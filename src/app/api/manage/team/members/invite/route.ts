import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';

type RequestBody = {
  siteName: string | null;
  email: string | null;
  role: string | null;
};

type CancelRequestBody = {
  siteName: string | null;
  inviteId: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function isAllowedRole(value: string) {
  return value === 'manager' || value === 'member';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getRoleLabel(role: string) {
  if (role === 'manager') {
    return '매니저';
  }

  if (role === 'member') {
    return '멤버';
  }

  return role;
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
  role: string;
  token: string;
  appUrl: string;
}) {
  const resend = getResendClient();
  const from = getInviteMailFrom();
  const appUrl = params.appUrl;
  const inviteUrl = `${appUrl}/${params.siteName}/invite-blog/${params.token}`;
  const siteLabel = params.siteLabel?.trim() || params.siteName;
  const roleLabel = getRoleLabel(params.role);

  await resend.emails.send({
    from,
    to: params.email,
    subject: `[${siteLabel}] 팀블로그 초대`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="margin: 0 0 16px;">팀블로그 초대</h2>
        <p style="margin: 0 0 8px;">사이트명: ${siteLabel}</p>
        <p style="margin: 0 0 8px;">역할: ${roleLabel}</p>
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
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type, site_label, site_key')
    .eq('site_key', siteName)
    .maybeSingle();

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
    siteKey: rhizome.data.site_key,
    siteLabel: rhizome.data.site_label as string | null,
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

    const nowIsoString = new Date().toISOString();
    const sevenDaysAgoIsoString = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const expireInvite = await access.supabaseAdmin
      .from('invite')
      .update({
        status: 'expired',
      })
      .eq('site_id', access.siteId)
      .eq('status', 'pending')
      .lt('expires_at', nowIsoString);

    if (expireInvite.error) {
      return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const deleteExpiredInvite = await access.supabaseAdmin
      .from('invite')
      .delete()
      .eq('site_id', access.siteId)
      .eq('status', 'expired')
      .lt('expires_at', sevenDaysAgoIsoString);

    if (deleteExpiredInvite.error) {
      return Response.json({ error: '초대 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const invite = await access.supabaseAdmin
      .from('invite')
      .select('id, email, role, status, expires_at, accepted_user_id, joined_at, cancelled_at')
      .eq('site_id', access.siteId)
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
    const role = normalizeText(requestBody.role).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!email) {
      return Response.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return Response.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    if (!isAllowedRole(role)) {
      return Response.json({ error: '초대 역할이 올바르지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const duplicatePendingInvite = await access.supabaseAdmin
      .from('invite')
      .select('id')
      .eq('site_id', access.siteId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (duplicatePendingInvite.error) {
      return Response.json(
        { error: duplicatePendingInvite.error.message || '초대 정보 확인에 실패했습니다.' },
        { status: 500 },
      );
    }

    if (duplicatePendingInvite.data) {
      return Response.json({ error: '이미 대기 중인 초대가 있습니다.' }, { status: 400 });
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const invite = await access.supabaseAdmin
      .from('invite')
      .insert({
        site_id: access.siteId,
        email,
        role,
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
        role,
        token,
        appUrl,
      });
    } catch (unknownError) {
      await access.supabaseAdmin.from('invite').delete().eq('id', invite.data.id);

      if (unknownError instanceof Error) {
        return Response.json(
          {
            error: unknownError.message || '초대 메일 발송에 실패했습니다.',
          },
          {
            status: 500,
          },
        );
      }

      return Response.json(
        {
          error: '초대 메일 발송에 실패했습니다.',
        },
        {
          status: 500,
        },
      );
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
        notification_type: NOTIFICATION_TYPE.BLOG_TEAM_INVITATION_SENT,
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
    const requestBody = (await request.json()) as CancelRequestBody;

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
