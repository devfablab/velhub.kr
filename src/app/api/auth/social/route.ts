import crypto from 'crypto';
import { EMAIL_PATTERN, isValidActivityName } from '@/lib/auth/emailSignUp';
import { type SocialSignUpFieldErrors, validateSocialSignUpFields } from '@/lib/auth/socialSignUp';
import { encrypt } from '@/lib/encryption/encrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type SocialRequestBody = {
  authUserId?: string | null;
  email?: string | null;
  provider?: string | null;
  providerAccountId?: string | null;
  userName?: string | null;
  avatar?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: number | null;
  isAgreeTerm?: boolean | null;
  isAgreeChild?: boolean | null;
  isAgreePrivacy?: boolean | null;
  paymentEmail?: string | null;
};

const SUPPORTED_PROVIDERS = new Set(['google', 'github', 'kakao', 'naver']);

function getTokenExpiresAtDateTime(tokenExpiresAt: number | null | undefined) {
  if (!tokenExpiresAt || !Number.isFinite(tokenExpiresAt)) return null;
  const value = new Date(tokenExpiresAt * 1000);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function validationError(fieldErrors: SocialSignUpFieldErrors) {
  return Response.json(
    {
      title: '회원가입 정보 확인',
      errors: Object.values(fieldErrors).filter(Boolean),
      fieldErrors,
    },
    { status: 400 },
  );
}

function knownError(title: string, message: string, status: number) {
  return Response.json({ title, errors: [message] }, { status });
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as SocialRequestBody;
    const sessionClaims = await getSessionClaims();
    const requestedAuthUserId = requestBody.authUserId?.trim() ?? '';

    if (!sessionClaims?.userId || !requestedAuthUserId || sessionClaims.userId !== requestedAuthUserId) {
      return knownError('로그인 정보 확인', '소셜 로그인 정보가 만료되었습니다. 다시 로그인해 주세요.', 401);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const authUserResult = await supabaseAdmin.auth.admin.getUserById(sessionClaims.userId);
    const authEmail = authUserResult.data.user?.email;

    if (authUserResult.error || !authEmail) {
      return knownError('로그인 정보 확인', '소셜 로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.', 401);
    }

    const authUser = authUserResult.data.user;
    const metadataProvider =
      typeof authUser.user_metadata?.provider === 'string' ? authUser.user_metadata.provider.trim().toLowerCase() : '';
    const requestedProvider = requestBody.provider?.trim().toLowerCase() ?? '';
    const provider =
      metadataProvider === 'naver'
        ? 'naver'
        : String(
            SUPPORTED_PROVIDERS.has(requestedProvider) &&
              authUser.identities?.some((identity) => identity.provider === requestedProvider)
              ? requestedProvider
              : (authUser.identities?.find((identity) => SUPPORTED_PROVIDERS.has(identity.provider))?.provider ??
                  authUser.app_metadata?.provider ??
                  metadataProvider),
          )
            .trim()
            .toLowerCase();
    const email = authEmail.trim().toLowerCase();

    if (!SUPPORTED_PROVIDERS.has(provider)) {
      return knownError('로그인 정보 확인', '지원하지 않는 소셜 로그인입니다.', 400);
    }

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id, is_agree_term, is_agree_child, is_agree_privacy')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error) {
      console.error('[auth-social] profile select error', stigmaResult.error);
      return Response.json(
        { errors: ['회원 정보를 확인하지 못했습니다.\n잠시 후 다시 시도해 주세요.'] },
        { status: 500 },
      );
    }

    const hasCompletedSignUp = Boolean(
      stigmaResult.data?.is_agree_term === true &&
      stigmaResult.data?.is_agree_child === true &&
      stigmaResult.data?.is_agree_privacy === true,
    );
    const isSignUpRequest = !hasCompletedSignUp;
    let userName = requestBody.userName?.trim() ?? '';
    let paymentEmail = requestBody.paymentEmail?.trim().toLowerCase() ?? '';

    if (isSignUpRequest) {
      const validation = validateSocialSignUpFields({
        provider,
        userName,
        paymentEmail,
        isAgreeTerm: requestBody.isAgreeTerm === true,
        isAgreeChild: requestBody.isAgreeChild === true,
        isAgreePrivacy: requestBody.isAgreePrivacy === true,
      });

      if (validation.messages.length > 0) return validationError(validation.fieldErrors);
      userName = validation.userName;
      paymentEmail = validation.paymentEmail;
    } else {
      if (userName && !isValidActivityName(userName)) userName = '';
      if (paymentEmail && !EMAIL_PATTERN.test(paymentEmail)) paymentEmail = '';
    }

    const providerAccountId =
      provider === 'naver'
        ? typeof authUser.user_metadata?.naver_id === 'string'
          ? authUser.user_metadata.naver_id.trim()
          : requestBody.providerAccountId?.trim() || null
        : (authUser.identities?.find((identity) => identity.provider === provider)?.id ??
          requestBody.providerAccountId?.trim() ??
          null);
    const avatar = requestBody.avatar?.trim() || null;
    const accessToken = requestBody.accessToken?.trim() || null;
    const refreshToken = requestBody.refreshToken?.trim() || null;
    const tokenExpiresAt = getTokenExpiresAtDateTime(requestBody.tokenExpiresAt);

    const particlesUpsertResult = await supabaseAdmin
      .from('particles')
      .upsert({ id: sessionClaims.userId, email, social: true }, { onConflict: 'id' });

    if (particlesUpsertResult.error) {
      console.error('[auth-social] account save error', particlesUpsertResult.error);
      return Response.json(
        { errors: ['회원가입 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.'] },
        { status: 500 },
      );
    }

    const profilePayload = isSignUpRequest
      ? {
          user_name: encrypt(userName),
          email: encrypt(email),
          payment_email: provider === 'naver' ? encrypt(paymentEmail) : null,
          avatar,
          is_agree_term: true,
          is_agree_child: true,
          is_agree_privacy: true,
        }
      : {
          email: encrypt(email),
          ...(avatar ? { avatar } : {}),
        };

    if (stigmaResult.data) {
      const updateResult = await supabaseAdmin
        .from('stigmas')
        .update(profilePayload)
        .eq('user_id', sessionClaims.userId);

      if (updateResult.error) {
        console.error('[auth-social] profile update error', updateResult.error);
        return Response.json(
          { errors: ['회원 정보를 저장하지 못했습니다.\n잠시 후 다시 시도해 주세요.'] },
          { status: 500 },
        );
      }
    } else {
      const insertResult = await supabaseAdmin.from('stigmas').insert({
        id: crypto.randomUUID(),
        user_id: sessionClaims.userId,
        user_name: encrypt(userName),
        bio: null,
        avatar,
        role: 'user',
        email: encrypt(email),
        payment_email: provider === 'naver' && paymentEmail ? encrypt(paymentEmail) : null,
        is_agree_term: true,
        is_agree_child: true,
        is_agree_privacy: true,
      });

      if (insertResult.error) {
        console.error('[auth-social] profile insert error', insertResult.error);
        return Response.json(
          { errors: ['회원 정보를 저장하지 못했습니다.\n잠시 후 다시 시도해 주세요.'] },
          { status: 500 },
        );
      }
    }

    const electronResult = await supabaseAdmin
      .from('electrons')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .eq('service', provider)
      .maybeSingle();

    if (electronResult.error) {
      console.error('[auth-social] connection select error', electronResult.error);
      return Response.json(
        { errors: ['소셜 로그인 연결 정보를 확인하지 못했습니다.\n잠시 후 다시 시도해 주세요.'] },
        { status: 500 },
      );
    }

    const connectionPayload = {
      account_id: providerAccountId,
      ...(accessToken ? { access_token: accessToken } : {}),
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      ...(tokenExpiresAt ? { token_expires_at: tokenExpiresAt } : {}),
    };

    if (electronResult.data) {
      const updateResult = await supabaseAdmin
        .from('electrons')
        .update(connectionPayload)
        .eq('id', electronResult.data.id);

      if (updateResult.error) {
        console.error('[auth-social] connection update error', updateResult.error);
        return Response.json(
          { errors: ['소셜 로그인 연결 정보를 저장하지 못했습니다.\n잠시 후 다시 시도해 주세요.'] },
          { status: 500 },
        );
      }
    } else {
      const insertResult = await supabaseAdmin.from('electrons').insert({
        id: crypto.randomUUID(),
        user_id: sessionClaims.userId,
        service: provider,
        ...connectionPayload,
      });

      if (insertResult.error) {
        console.error('[auth-social] connection insert error', insertResult.error);
        return Response.json(
          { errors: ['소셜 로그인 연결 정보를 저장하지 못했습니다.\n잠시 후 다시 시도해 주세요.'] },
          { status: 500 },
        );
      }
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    console.error('[auth-social] unexpected error', unknownError);
    return Response.json(
      { errors: ['소셜 로그인 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.'] },
      { status: 500 },
    );
  }
}
