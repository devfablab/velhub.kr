import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encrypt } from '@/lib/encryption/encrypt';

type SocialRequestBody = {
  authUserId: string | null;
  email: string | null;
  provider: string | null;
  providerAccountId: string | null;
  userName: string | null;
  avatar: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
};

function getSafeUserName(userName: string | null, email: string) {
  if (userName && userName.trim()) {
    return userName.trim();
  }

  const emailLocalPart = email.split('@')[0]?.trim();

  if (emailLocalPart) {
    return emailLocalPart;
  }

  return 'social-user';
}

function getTokenExpiresAtDateTime(tokenExpiresAt: number | null) {
  if (!tokenExpiresAt) {
    return null;
  }

  return new Date(tokenExpiresAt * 1000).toISOString();
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as SocialRequestBody;

    const authUserId = requestBody.authUserId?.trim() ?? '';
    const email = requestBody.email?.trim().toLowerCase() ?? '';
    const provider = requestBody.provider?.trim().toLowerCase() ?? '';
    const providerAccountId = requestBody.providerAccountId?.trim() ?? null;
    const avatar = requestBody.avatar?.trim() ?? null;
    const accessToken = requestBody.accessToken?.trim() ?? null;
    const refreshToken = requestBody.refreshToken?.trim() ?? null;
    const tokenExpiresAt = getTokenExpiresAtDateTime(requestBody.tokenExpiresAt);

    if (!authUserId) {
      return Response.json({ error: 'authUserId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!email) {
      return Response.json({ error: '이메일이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!provider) {
      return Response.json({ error: 'provider가 유효하지 않습니다.' }, { status: 400 });
    }

    const safeUserName = getSafeUserName(requestBody.userName ?? null, email);

    const encryptedEmail = encrypt(email);
    const encryptedUserName = encrypt(safeUserName);

    const supabaseAdmin = getSupabaseAdmin();

    const particlesUpsertResult = await supabaseAdmin.from('particles').upsert(
      {
        id: authUserId,
        email,
        social: true,
      },
      {
        onConflict: 'id',
      },
    );

    if (particlesUpsertResult.error) {
      console.error('particles 저장 실패:', particlesUpsertResult.error);
      return Response.json({ error: 'particles 저장에 실패했습니다.' }, { status: 500 });
    }

    const stigmasSelectResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (stigmasSelectResult.error) {
      console.error('stigmas 조회 실패:', stigmasSelectResult.error);
      return Response.json({ error: 'stigmas 조회에 실패했습니다.' }, { status: 500 });
    }

    if (stigmasSelectResult.data) {
      const stigmasUpdateResult = await supabaseAdmin
        .from('stigmas')
        .update({
          user_name: encryptedUserName,
          email: encryptedEmail,
          avatar,
        })
        .eq('user_id', authUserId);

      if (stigmasUpdateResult.error) {
        console.error('stigmas 수정 실패:', stigmasUpdateResult.error);
        return Response.json({ error: 'stigmas 수정에 실패했습니다.' }, { status: 500 });
      }
    } else {
      const stigmasInsertResult = await supabaseAdmin.from('stigmas').insert({
        id: crypto.randomUUID(),
        user_id: authUserId,
        user_name: encryptedUserName,
        bio: null,
        avatar,
        role: 'user',
        email: encryptedEmail,
      });

      if (stigmasInsertResult.error) {
        console.error('stigmas 생성 실패:', stigmasInsertResult.error);
        return Response.json({ error: 'stigmas 생성에 실패했습니다.' }, { status: 500 });
      }
    }

    const electronsSelectResult = await supabaseAdmin
      .from('electrons')
      .select('id')
      .eq('user_id', authUserId)
      .eq('service', provider)
      .maybeSingle();

    if (electronsSelectResult.error) {
      console.error('electrons 조회 실패:', electronsSelectResult.error);
      return Response.json({ error: 'electrons 조회에 실패했습니다.' }, { status: 500 });
    }

    if (electronsSelectResult.data) {
      const electronsUpdateResult = await supabaseAdmin
        .from('electrons')
        .update({
          account_id: providerAccountId,
          refresh_token: refreshToken,
          access_token: accessToken,
          token_expires_at: tokenExpiresAt,
        })
        .eq('id', electronsSelectResult.data.id);

      if (electronsUpdateResult.error) {
        console.error('electrons 수정 실패:', electronsUpdateResult.error);
        return Response.json({ error: 'electrons 수정에 실패했습니다.' }, { status: 500 });
      }
    } else {
      const electronsInsertResult = await supabaseAdmin.from('electrons').insert({
        id: crypto.randomUUID(),
        user_id: authUserId,
        service: provider,
        account_id: providerAccountId,
        refresh_token: refreshToken,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
      });

      if (electronsInsertResult.error) {
        console.error('electrons 생성 실패:', electronsInsertResult.error);
        return Response.json({ error: 'electrons 생성에 실패했습니다.' }, { status: 500 });
      }
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    console.error('소셜 로그인 처리 실패:', unknownError);
    return Response.json({ error: '소셜 로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
