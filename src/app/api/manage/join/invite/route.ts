import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import { normalizeText } from '@/lib/utils';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { getSiteMemberLimitStatus } from '@/lib/siteMemberLimit';

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
      <table style="border-collapse:collapse;width:100%;border-style:none;margin-left:auto;margin-right:auto" border="0">
        <tr>
          <td style="background-color:#181818">
            <div style="max-width:575px;width:100%;padding:23px;box-sizing:border-box;margin:0 auto"><img style="border-style:none" src="https://velhub.xyz/velhub-1-webmail.png" alt="데브허브" width="106" height="24"></div>
          </td>
        </tr>
        <tr>
          <td>
            <div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;color:#181818;">
              <h1>커뮤니티 초대</h1>
              <p>콘텐츠에 가치를 더하는 복합 허브 서비스, 데브허브입니다.</p>
              <p>아래 정보를 확인하시고 가압해 주세요.</p>
              <table style="border-collapse:collapse;width:100%;border-style:none;margin-left:auto;margin-right:auto" border="0">
                <tr>
                  <td style="background-color:#181818;color:#d7d7d7;height:53px;text-align:center;font-weight:bolder">사이트</td>
                  <td style="background-color:#181818;color:#d7d7d7;text-align:center;font-weight:bolder">역할</td>
                  <td style="background-color:#181818;color:#d7d7d7;text-align:center;font-weight:bolder">초대 유효시간</td>
                </tr>
                <tr>
                  <td style="height:53px;text-align:center">${siteLabel}</td>
                  <td style="height:53px;text-align:center">멤버</td>
                  <td style="height:53px;text-align:center">24시간</td>
                </tr>
                <tr>
                  <td style="background-color:#181818;height:1px"></td>
                  <td style="background-color:#181818;height:1px"></td>
                  <td style="background-color:#181818;height:1px"></td>
                </tr>
              </table>
              <p style="text-align:center"><a href="${inviteUrl}" style="background-color:#eeb400;color:#181818;display:inline-block;padding:12px 23px;border-radius:12px;font-weight:bolder;text-decoration:none">가입하러 가기</a></p>
              <p><strong style="font-size: 12px">Everyday, Everywhere, Everymoments - Velhub</strong></p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#181818">
            <div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;"><span style="color:#d7d7d7;font-size:12px">&copy; <img src="https://velhub.xyz/velhub-2-webmail.png" alt="데브런닷스튜디오" width="90" height="12"> All rights reserved. <strong style="color:#ff69b4;padding-left:12px">&hearts; velhub</strong></span></div>
          </td>
        </tr>
      </table>
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

    const memberLimit = await getSiteMemberLimitStatus(access.siteId);

    if (memberLimit.currentCount >= memberLimit.limit) {
      return Response.json({ error: '현재 요금제의 회원 수 제한에 도달하여 초대할 수 없습니다.' }, { status: 400 });
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
      const invitedStigmaResult = await access.supabaseAdmin
        .from('stigmas')
        .select('id')
        .eq('user_id', invitedUserResult.data.id)
        .maybeSingle();

      if (invitedStigmaResult.error) {
        console.error(invitedStigmaResult.error);
      }

      if (invitedStigmaResult.data?.id) {
        const notificationResult = await access.supabaseAdmin.from('notifications').insert({
          user_id: invitedStigmaResult.data.id,
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
