import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function getNaverClientId() {
  const naverClientId = process.env.NAVER_CLIENT_ID;

  if (!naverClientId) {
    throw new Error('NAVER_CLIENT_ID가 설정되지 않았습니다.');
  }

  return naverClientId;
}

function getRedirectUri(request: NextRequest) {
  return new URL('/api/auth/naver/callback', request.nextUrl.origin).toString();
}

export async function GET(request: NextRequest) {
  try {
    const naverClientId = getNaverClientId();

    const inviteToken = request.nextUrl.searchParams.get('inviteToken')?.trim() ?? '';
    const siteName = request.nextUrl.searchParams.get('siteName')?.trim().toLowerCase() ?? '';
    const inviteType = request.nextUrl.searchParams.get('inviteType')?.trim().toLowerCase() ?? '';

    const stateToken = crypto.randomBytes(32).toString('hex');
    const statePayload = {
      stateToken,
      inviteToken,
      siteName,
      inviteType,
    };

    const state = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');

    const naverAuthorizeUrl = new URL('https://nid.naver.com/oauth2.0/authorize');
    naverAuthorizeUrl.searchParams.set('response_type', 'code');
    naverAuthorizeUrl.searchParams.set('client_id', naverClientId);
    naverAuthorizeUrl.searchParams.set('redirect_uri', getRedirectUri(request));
    naverAuthorizeUrl.searchParams.set('state', state);

    const response = NextResponse.redirect(naverAuthorizeUrl);
    response.cookies.set('velhub-naver-state', stateToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 10,
    });

    return response;
  } catch (unknownError) {
    console.error('네이버 로그인 시작 실패:', unknownError);

    const signInUrl = new URL('/auth/sign-in', request.nextUrl.origin);
    signInUrl.searchParams.set('error', 'naver_start_failed');

    return NextResponse.redirect(signInUrl);
  }
}
