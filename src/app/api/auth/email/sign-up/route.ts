import crypto from 'crypto';
import { type EmailSignUpFieldErrors, validateEmailSignUpFields } from '@/lib/auth/emailSignUp';
import { encrypt } from '@/lib/encryption/encrypt';
import { verifyInviteEmailProof } from '@/lib/invites/emailProof';
import { getMailFrom, getResendClient } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase';

type EmailSignUpRequestBody = {
  email: string | null;
  userName: string | null;
  password: string | null;
  passwordConfirm: string | null;
  bypassEmailConfirm?: boolean | null;
  isAgreeTerm?: boolean | null;
  isAgreeChild?: boolean | null;
  isAgreePrivacy?: boolean | null;
  inviteToken?: string | null;
  inviteSiteName?: string | null;
  inviteType?: string | null;
  inviteProof?: string | null;
};

type InviteVerification = {
  id: string;
  emailConfirmed: boolean;
};

function validationResponse(fieldErrors: EmailSignUpFieldErrors) {
  return Response.json(
    {
      code: 'validation_failed',
      title: '회원가입 정보 확인',
      errors: Object.values(fieldErrors).filter(Boolean),
      fieldErrors,
    },
    { status: 400 },
  );
}

function knownErrorResponse(params: {
  status: number;
  code: string;
  title: string;
  errors: string[];
  fieldErrors?: Partial<EmailSignUpFieldErrors>;
}) {
  return Response.json(params, { status: params.status });
}

function isExpired(value: string | null) {
  if (!value) return true;
  const time = new Date(value).getTime();
  return Number.isNaN(time) || time < Date.now();
}

async function verifyEmailInvite(params: {
  inviteToken: string;
  inviteSiteName: string;
  inviteType: string;
  inviteProof: string;
  email: string;
}): Promise<InviteVerification | Response> {
  const hasAnyInviteValue = Boolean(
    params.inviteToken || params.inviteSiteName || params.inviteType || params.inviteProof,
  );

  if (!hasAnyInviteValue) return { id: '', emailConfirmed: false };

  if (
    !params.inviteToken ||
    !params.inviteSiteName ||
    (params.inviteType !== 'blog' && params.inviteType !== 'community')
  ) {
    return knownErrorResponse({
      status: 400,
      code: 'invalid_invite',
      title: '초대 정보 확인',
      errors: ['초대 링크 정보가 올바르지 않습니다.\n이메일에서 초대 링크를 다시 열어 주세요.'],
    });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const inviteResult = await supabaseAdmin
    .from('invite')
    .select(
      'id, site_id, email, status, expires_at, cancelled_at, joined_at, email_verification_token_hash, email_verification_expires_at, email_verification_used_at',
    )
    .eq('token', params.inviteToken)
    .maybeSingle();

  if (inviteResult.error) {
    console.error('초대 정보 조회 실패:', inviteResult.error);
    return knownErrorResponse({
      status: 500,
      code: 'invite_lookup_failed',
      title: '',
      errors: ['초대 정보를 확인하지 못했습니다.\n잠시 후 다시 시도해 주세요.'],
    });
  }

  const invite = inviteResult.data;

  if (!invite) {
    return knownErrorResponse({
      status: 404,
      code: 'invite_not_found',
      title: '초대 정보 확인',
      errors: ['초대장을 찾을 수 없습니다.'],
    });
  }

  if (invite.status !== 'pending' || invite.cancelled_at || invite.joined_at || isExpired(invite.expires_at)) {
    return knownErrorResponse({
      status: 400,
      code: 'invite_unavailable',
      title: '초대 정보 확인',
      errors: ['사용할 수 없거나 만료된 초대 링크입니다.'],
    });
  }

  if (invite.email.trim().toLowerCase() !== params.email) {
    return knownErrorResponse({
      status: 400,
      code: 'invite_email_mismatch',
      title: '초대 정보 확인',
      errors: ['초대받은 이메일과 회원가입 이메일이 일치하지 않습니다.'],
      fieldErrors: { email: '초대받은 이메일로 가입해 주세요.' },
    });
  }

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('site_key, site_type')
    .eq('id', invite.site_id)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    return knownErrorResponse({
      status: 404,
      code: 'invite_site_not_found',
      title: '초대 정보 확인',
      errors: ['초대 대상 사이트를 찾을 수 없습니다.'],
    });
  }

  if (siteResult.data.site_key !== params.inviteSiteName || siteResult.data.site_type !== params.inviteType) {
    return knownErrorResponse({
      status: 400,
      code: 'invite_site_mismatch',
      title: '초대 정보 확인',
      errors: ['초대 링크의 사이트 정보가 올바르지 않습니다.'],
    });
  }

  if (!params.inviteProof) return { id: '', emailConfirmed: false };

  const proofHash = invite.email_verification_token_hash?.trim() ?? '';

  if (
    !proofHash ||
    invite.email_verification_used_at ||
    isExpired(invite.email_verification_expires_at) ||
    !verifyInviteEmailProof(params.inviteProof, proofHash)
  ) {
    return knownErrorResponse({
      status: 400,
      code: 'invalid_invite_proof',
      title: '초대 정보 확인',
      errors: ['초대 링크의 이메일 확인 정보가 올바르지 않습니다.\n이메일에서 초대 링크를 다시 열어 주세요.'],
    });
  }

  return { id: invite.id, emailConfirmed: true };
}

async function cleanupCreatedUser(authUserId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin.from('stigmas').delete().eq('user_id', authUserId);
  await supabaseAdmin.from('particles').delete().eq('id', authUserId);
  await supabaseAdmin.auth.admin.deleteUser(authUserId);
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as EmailSignUpRequestBody;
    const email = requestBody.email?.trim().toLowerCase() ?? '';
    const userName = requestBody.userName?.trim() ?? '';
    const password = requestBody.password ?? '';
    const passwordConfirm = requestBody.passwordConfirm ?? '';
    const isAgreeTerm = requestBody.isAgreeTerm === true;
    const isAgreeChild = requestBody.isAgreeChild === true;
    const isAgreePrivacy = requestBody.isAgreePrivacy === true;
    const validation = validateEmailSignUpFields({
      email,
      userName,
      password,
      passwordConfirm,
      isAgreeTerm,
      isAgreeChild,
      isAgreePrivacy,
    });

    if (validation.messages.length > 0 || !validation.activityName) {
      return validationResponse(validation.fieldErrors);
    }

    const inviteVerification = await verifyEmailInvite({
      inviteToken: requestBody.inviteToken?.trim() ?? '',
      inviteSiteName: requestBody.inviteSiteName?.trim().toLowerCase() ?? '',
      inviteType: requestBody.inviteType?.trim().toLowerCase() ?? '',
      inviteProof: requestBody.inviteProof?.trim() ?? '',
      email,
    });

    if (inviteVerification instanceof Response) return inviteVerification;

    const supabaseAdmin = getSupabaseAdmin();
    const existingParticle = await supabaseAdmin
      .from('particles')
      .select('id, social')
      .eq('email', email)
      .maybeSingle();

    if (existingParticle.error) {
      console.error('기존 회원 조회 실패:', existingParticle.error);
      return knownErrorResponse({
        status: 500,
        code: 'account_lookup_failed',
        title: '',
        errors: ['회원 정보를 확인하지 못했습니다.\n잠시 후 다시 시도해 주세요.'],
      });
    }

    if (existingParticle.data) {
      if (!existingParticle.data.social) {
        const existingAuthUser = await supabaseAdmin.auth.admin.getUserById(existingParticle.data.id);

        if (!existingAuthUser.error && !existingAuthUser.data.user.email_confirmed_at) {
          return knownErrorResponse({
            status: 409,
            code: 'email_not_confirmed',
            title: '이메일 인증 확인',
            errors: ['이메일 인증이 완료되지 않았습니다.\n받은 인증 메일에서 인증을 완료해 주세요.'],
            fieldErrors: { email: '이메일 인증을 완료해 주세요.' },
          });
        }
      }

      return knownErrorResponse({
        status: 409,
        code: existingParticle.data.social ? 'social_account_exists' : 'email_account_exists',
        title: '가입 계정 확인',
        errors: [
          existingParticle.data.social
            ? '소셜 로그인으로 가입된 이메일입니다.\n가입할 때 사용한 소셜 계정으로 로그인해 주세요.'
            : '이미 가입된 이메일입니다.\n로그인하거나 비밀번호를 재설정해 주세요.',
        ],
        fieldErrors: {
          email: existingParticle.data.social ? '소셜 로그인으로 가입된 이메일입니다.' : '이미 가입된 이메일입니다.',
        },
      });
    }

    const bypassEmailConfirm = process.env.NODE_ENV === 'development' && requestBody.bypassEmailConfirm === true;
    const emailConfirmed = inviteVerification.emailConfirmed || bypassEmailConfirm;
    let authUserId = '';
    let actionLink = '';

    if (emailConfirmed) {
      const createUserResult = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });

      if (createUserResult.error || !createUserResult.data.user) {
        const duplicate = createUserResult.error?.message.toLowerCase().includes('already');
        return knownErrorResponse({
          status: duplicate ? 409 : 500,
          code: duplicate ? 'account_exists' : 'account_create_failed',
          title: duplicate ? '가입 계정 확인' : '',
          errors: [
            duplicate
              ? '이미 가입 절차가 진행된 이메일입니다.\n로그인하거나 이메일 인증 메일을 확인해 주세요.'
              : '회원 정보를 만들지 못했습니다.\n잠시 후 다시 시도해 주세요.',
          ],
          fieldErrors: duplicate ? { email: '이미 가입 절차가 진행된 이메일입니다.' } : undefined,
        });
      }

      authUserId = createUserResult.data.user.id;
    } else {
      const redirectUrl = new URL('/auth/sign-in', new URL(request.url).origin);

      if (requestBody.inviteToken) redirectUrl.searchParams.set('inviteToken', requestBody.inviteToken.trim());
      if (requestBody.inviteSiteName) redirectUrl.searchParams.set('siteName', requestBody.inviteSiteName.trim());
      if (requestBody.inviteType) redirectUrl.searchParams.set('inviteType', requestBody.inviteType.trim());

      const generateLinkResult = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: { redirectTo: redirectUrl.toString() },
      });

      if (generateLinkResult.error || !generateLinkResult.data.properties.action_link) {
        const duplicate = generateLinkResult.error?.message.toLowerCase().includes('already');
        return knownErrorResponse({
          status: duplicate ? 409 : 500,
          code: duplicate ? 'account_exists' : 'verification_link_failed',
          title: duplicate ? '가입 계정 확인' : '',
          errors: [
            duplicate
              ? '이미 가입 절차가 진행된 이메일입니다.\n로그인하거나 이메일 인증 메일을 확인해 주세요.'
              : '이메일 인증 링크를 만들지 못했습니다.\n잠시 후 다시 시도해 주세요.',
          ],
          fieldErrors: duplicate ? { email: '이미 가입 절차가 진행된 이메일입니다.' } : undefined,
        });
      }

      authUserId = generateLinkResult.data.user.id;
      actionLink = generateLinkResult.data.properties.action_link;
    }

    const particleResult = await supabaseAdmin.from('particles').insert({ id: authUserId, email, social: false });

    if (particleResult.error) {
      console.error('particles 저장 실패:', particleResult.error);
      await cleanupCreatedUser(authUserId);
      return knownErrorResponse({
        status: 500,
        code: 'profile_save_failed',
        title: '',
        errors: ['회원 정보를 저장하지 못했습니다.\n잠시 후 다시 시도해 주세요.'],
      });
    }

    const stigmaResult = await supabaseAdmin.from('stigmas').insert({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      user_name: encrypt(validation.activityName),
      bio: null,
      avatar: null,
      user_id: authUserId,
      role: 'user',
      email: encrypt(email),
      is_agree_term: true,
      is_agree_child: true,
      is_agree_privacy: true,
    });

    if (stigmaResult.error) {
      console.error('stigmas 저장 실패:', stigmaResult.error);
      await cleanupCreatedUser(authUserId);
      return knownErrorResponse({
        status: 500,
        code: 'profile_save_failed',
        title: '',
        errors: ['회원 정보를 저장하지 못했습니다.\n잠시 후 다시 시도해 주세요.'],
      });
    }

    if (inviteVerification.id) {
      const useProofResult = await supabaseAdmin
        .from('invite')
        .update({ email_verification_used_at: new Date().toISOString() })
        .eq('id', inviteVerification.id)
        .is('email_verification_used_at', null);

      if (useProofResult.error) {
        console.error('초대 이메일 확인 처리 실패:', useProofResult.error);
        await cleanupCreatedUser(authUserId);
        return knownErrorResponse({
          status: 500,
          code: 'invite_verification_save_failed',
          title: '',
          errors: ['초대 정보를 저장하지 못했습니다.\n잠시 후 다시 시도해 주세요.'],
        });
      }
    }

    if (actionLink) {
      const sendResult = await getResendClient().emails.send({
        from: getMailFrom(),
        to: email,
        subject: '[데브허브] 이메일 인증을 완료해 주세요',
        html: `
          <table style="border-collapse:collapse;width:100%;border-style:none;margin-left:auto;margin-right:auto" border="0">
            <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;box-sizing:border-box;margin:0 auto"><img style="border-style:none" src="https://velhub.xyz/velhub-1-webmail.png" alt="데브허브" width="106" height="24"></div></td></tr>
            <tr><td><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;color:#181818;"><h2>데브허브 이메일 인증</h2><p>콘텐츠에 가치를 더하는 복합 허브 서비스, 데브허브입니다.</p><p>데브허브 회원가입을 완료하려면 아래 버튼을 눌러 이메일 인증을 진행해 주세요.</p><p style="text-align:center"><a href="${actionLink}" style="background-color:#eeb400;color:#181818;display:inline-block;padding:12px 23px;border-radius:12px;font-weight:bolder;text-decoration:none">이메일 인증하기</a></p><p>본인이 회원가입을 요청하지 않았다면 이 이메일을 무시해 주세요.</p></div></td></tr>
          </table>
        `,
      });

      if (sendResult.error) {
        console.error('회원가입 인증 메일 발송 실패:', sendResult.error);
        await cleanupCreatedUser(authUserId);
        return knownErrorResponse({
          status: 500,
          code: 'verification_email_failed',
          title: '',
          errors: ['이메일 인증 메일을 보내지 못했습니다.\n잠시 후 다시 시도해 주세요.'],
        });
      }
    }

    return Response.json({ ok: true, emailConfirmed });
  } catch (unknownError) {
    console.error('이메일 회원가입 처리 실패:', unknownError);
    return Response.json(
      {
        code: 'unknown_error',
        title: '',
        errors: ['회원가입 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.'],
      },
      { status: 500 },
    );
  }
}
