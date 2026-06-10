import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encrypt } from '@/lib/encryption/encrypt';

type NaverState = {
  stateToken: string;
  inviteToken: string;
  siteName: string;
  inviteType: string;
};

type NaverTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: string;
  error?: string;
  error_description?: string;
};

type NaverProfileResponse = {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    nickname?: string;
    name?: string;
    profile_image?: string;
    email?: string;
  };
};

function getSupabaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  }

  return supabaseUrl;
}

function getSupabaseBrowserKey() {
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabasePublishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.');
  }

  return supabasePublishableKey;
}

function getNaverClientId() {
  const naverClientId = process.env.NAVER_CLIENT_ID;

  if (!naverClientId) {
    throw new Error('NAVER_CLIENT_ID가 설정되지 않았습니다.');
  }

  return naverClientId;
}

function getNaverClientSecret() {
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!naverClientSecret) {
    throw new Error('NAVER_CLIENT_SECRET이 설정되지 않았습니다.');
  }

  return naverClientSecret;
}

function getNaverAuthPasswordSecret() {
  const naverAuthPasswordSecret = process.env.NAVER_AUTH_PASSWORD_SECRET;

  if (!naverAuthPasswordSecret) {
    throw new Error('NAVER_AUTH_PASSWORD_SECRET이 설정되지 않았습니다.');
  }

  return naverAuthPasswordSecret;
}

function getRedirectUri(request: NextRequest) {
  return new URL('/api/auth/naver/callback', request.nextUrl.origin).toString();
}

function parseNaverState(state: string | null): NaverState {
  if (!state) {
    throw new Error('네이버 로그인 state가 없습니다.');
  }

  const parsedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as Partial<NaverState>;

  if (!parsedState.stateToken) {
    throw new Error('네이버 로그인 state가 유효하지 않습니다.');
  }

  return {
    stateToken: parsedState.stateToken,
    inviteToken: parsedState.inviteToken?.trim() ?? '',
    siteName: parsedState.siteName?.trim().toLowerCase() ?? '',
    inviteType: parsedState.inviteType?.trim().toLowerCase() ?? '',
  };
}

function createNaverEmail(naverId: string) {
  const naverIdHash = crypto.createHash('sha256').update(naverId).digest('hex');

  return `naver_${naverIdHash}@auth.velhub.local`;
}

function createNaverPassword(naverId: string) {
  return crypto.createHmac('sha256', getNaverAuthPasswordSecret()).update(naverId).digest('base64url');
}

function getSafeNaverUserName(profile: NaverProfileResponse['response'], naverEmail: string) {
  const naverUserName = profile?.nickname?.trim() || profile?.name?.trim();

  if (naverUserName) {
    return naverUserName;
  }

  return naverEmail.split('@')[0] || 'naver-user';
}

async function getNaverToken(request: NextRequest, code: string, state: string) {
  const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
  tokenUrl.searchParams.set('grant_type', 'authorization_code');
  tokenUrl.searchParams.set('client_id', getNaverClientId());
  tokenUrl.searchParams.set('client_secret', getNaverClientSecret());
  tokenUrl.searchParams.set('redirect_uri', getRedirectUri(request));
  tokenUrl.searchParams.set('code', code);
  tokenUrl.searchParams.set('state', state);

  const tokenResponse = await fetch(tokenUrl, {
    method: 'GET',
    cache: 'no-store',
  });

  const tokenResult = (await tokenResponse.json()) as NaverTokenResponse;

  if (!tokenResponse.ok || tokenResult.error || !tokenResult.access_token) {
    throw new Error(tokenResult.error_description || '네이버 access token 발급에 실패했습니다.');
  }

  return {
    ...tokenResult,
    access_token: tokenResult.access_token,
  };
}

async function getNaverProfile(accessToken: string) {
  const profileResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  const profileResult = (await profileResponse.json()) as NaverProfileResponse;

  if (!profileResponse.ok || profileResult.resultcode !== '00' || !profileResult.response?.id) {
    throw new Error(profileResult.message || '네이버 사용자 정보를 가져오지 못했습니다.');
  }

  return profileResult.response;
}

async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseBrowserKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookieToSet) => {
          cookieStore.set(cookieToSet.name, cookieToSet.value, cookieToSet.options);
        });
      },
    },
  });
}

async function getOrCreateNaverAuthUser(naverId: string, naverEmail: string, userName: string, avatar: string | null) {
  const supabaseAdmin = getSupabaseAdmin();

  const electronsResult = await supabaseAdmin
    .from('electrons')
    .select('user_id')
    .eq('service', 'naver')
    .eq('account_id', naverId)
    .maybeSingle();

  if (electronsResult.error) {
    throw new Error('네이버 계정 연결 정보를 확인하지 못했습니다.');
  }

  if (electronsResult.data?.user_id) {
    return electronsResult.data.user_id as string;
  }

  const naverPassword = createNaverPassword(naverId);

  const createUserResult = await supabaseAdmin.auth.admin.createUser({
    email: naverEmail,
    password: naverPassword,
    email_confirm: true,
    user_metadata: {
      provider: 'naver',
      name: userName,
      avatar_url: avatar,
    },
  });

  if (createUserResult.error || !createUserResult.data.user) {
    throw new Error(createUserResult.error?.message || '네이버 사용자 생성에 실패했습니다.');
  }

  return createUserResult.data.user.id;
}

async function saveNaverSocialUser(params: {
  authUserId: string;
  naverId: string;
  naverEmail: string;
  userName: string;
  avatar: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: string | undefined;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const encryptedEmail = encrypt(params.naverEmail);
  const encryptedUserName = encrypt(params.userName);
  const tokenExpiresAt = params.expiresIn ? new Date(Date.now() + Number(params.expiresIn) * 1000).toISOString() : null;

  const particlesResult = await supabaseAdmin.from('particles').upsert(
    {
      id: params.authUserId,
      email: params.naverEmail,
      social: true,
    },
    {
      onConflict: 'id',
    },
  );

  if (particlesResult.error) {
    throw new Error('particles 저장에 실패했습니다.');
  }

  const stigmasResult = await supabaseAdmin.from('stigmas').select('id').eq('user_id', params.authUserId).maybeSingle();

  if (stigmasResult.error) {
    throw new Error('stigmas 조회에 실패했습니다.');
  }

  if (stigmasResult.data) {
    const stigmasUpdateResult = await supabaseAdmin
      .from('stigmas')
      .update({
        user_name: encryptedUserName,
        email: encryptedEmail,
        avatar: params.avatar,
      })
      .eq('user_id', params.authUserId);

    if (stigmasUpdateResult.error) {
      throw new Error('stigmas 수정에 실패했습니다.');
    }
  } else {
    const stigmasInsertResult = await supabaseAdmin.from('stigmas').insert({
      id: crypto.randomUUID(),
      user_id: params.authUserId,
      user_name: encryptedUserName,
      bio: null,
      avatar: params.avatar,
      role: 'user',
      email: encryptedEmail,
    });

    if (stigmasInsertResult.error) {
      throw new Error('stigmas 생성에 실패했습니다.');
    }
  }

  const electronsResult = await supabaseAdmin
    .from('electrons')
    .select('id')
    .eq('user_id', params.authUserId)
    .eq('service', 'naver')
    .maybeSingle();

  if (electronsResult.error) {
    throw new Error('electrons 조회에 실패했습니다.');
  }

  if (electronsResult.data) {
    const electronsUpdateResult = await supabaseAdmin
      .from('electrons')
      .update({
        account_id: params.naverId,
        refresh_token: params.refreshToken,
        access_token: params.accessToken,
        token_expires_at: tokenExpiresAt,
      })
      .eq('id', electronsResult.data.id);

    if (electronsUpdateResult.error) {
      throw new Error('electrons 수정에 실패했습니다.');
    }

    return;
  }

  const electronsInsertResult = await supabaseAdmin.from('electrons').insert({
    id: crypto.randomUUID(),
    user_id: params.authUserId,
    service: 'naver',
    account_id: params.naverId,
    refresh_token: params.refreshToken,
    access_token: params.accessToken,
    token_expires_at: tokenExpiresAt,
  });

  if (electronsInsertResult.error) {
    throw new Error('electrons 생성에 실패했습니다.');
  }
}

function getRedirectAfterNaverLogin(request: NextRequest, state: NaverState) {
  if (state.inviteType === 'community' && state.inviteToken && state.siteName) {
    return new URL(`/${state.siteName}/invite-community/${state.inviteToken}`, request.nextUrl.origin);
  }

  if (state.siteName) {
    return new URL(`/${state.siteName}`, request.nextUrl.origin);
  }

  return new URL('/', request.nextUrl.origin);
}

export async function GET(request: NextRequest) {
  const signInUrl = new URL('/auth/sign-in', request.nextUrl.origin);

  try {
    const state = request.nextUrl.searchParams.get('state');
    const code = request.nextUrl.searchParams.get('code');
    const error = request.nextUrl.searchParams.get('error');
    const storedStateToken = request.cookies.get('velhub-naver-state')?.value ?? '';
    const parsedState = parseNaverState(state);

    if (error) {
      throw new Error('네이버 로그인이 취소되었거나 실패했습니다.');
    }

    if (!code) {
      throw new Error('네이버 로그인 code가 없습니다.');
    }

    if (!storedStateToken || storedStateToken !== parsedState.stateToken) {
      throw new Error('네이버 로그인 state가 일치하지 않습니다.');
    }

    const tokenResult = await getNaverToken(request, code, state ?? '');
    const naverProfile = await getNaverProfile(tokenResult.access_token as string);
    const naverId = naverProfile.id as string;
    const naverEmail = createNaverEmail(naverId);
    const naverPassword = createNaverPassword(naverId);
    const userName = getSafeNaverUserName(naverProfile, naverEmail);
    const avatar = naverProfile.profile_image?.trim() || null;

    const authUserId = await getOrCreateNaverAuthUser(naverId, naverEmail, userName, avatar);

    await saveNaverSocialUser({
      authUserId,
      naverId,
      naverEmail,
      userName,
      avatar,
      accessToken: tokenResult.access_token,
      refreshToken: tokenResult.refresh_token?.trim() || null,
      expiresIn: tokenResult.expires_in,
    });

    const supabaseServer = await getSupabaseServer();
    const signInResult = await supabaseServer.auth.signInWithPassword({
      email: naverEmail,
      password: naverPassword,
    });

    if (signInResult.error) {
      throw new Error(signInResult.error.message);
    }

    const redirectUrl = getRedirectAfterNaverLogin(request, parsedState);
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.delete('velhub-naver-state');

    return response;
  } catch (unknownError) {
    console.error('네이버 로그인 처리 실패:', unknownError);

    signInUrl.searchParams.set('error', 'naver_callback_failed');

    const response = NextResponse.redirect(signInUrl);
    response.cookies.delete('velhub-naver-state');

    return response;
  }
}
