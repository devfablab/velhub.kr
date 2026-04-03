import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encrypt } from '@/lib/encryption/encrypt';

type EmailSignUpRequestBody = {
  authUserId: string | null;
  email: string | null;
  userName: string | null;
};

function getSafeUserName(userName: string | null, email: string) {
  if (userName && userName.trim()) {
    return userName.trim();
  }

  const emailLocalPart = email.split('@')[0]?.trim();

  if (emailLocalPart) {
    return emailLocalPart;
  }

  return 'user';
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as EmailSignUpRequestBody;

    const authUserId = requestBody.authUserId?.trim() ?? '';
    const email = requestBody.email?.trim().toLowerCase() ?? '';
    const userName = requestBody.userName?.trim() ?? '';

    if (!authUserId) {
      return Response.json({ error: 'authUserId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!email) {
      return Response.json({ error: '이메일이 유효하지 않습니다.' }, { status: 400 });
    }

    const safeUserName = getSafeUserName(userName, email);

    const encryptedEmail = encrypt(email);
    const encryptedUserName = encrypt(safeUserName);

    const supabaseAdmin = getSupabaseAdmin();

    const particlesUpsertResult = await supabaseAdmin.from('particles').upsert(
      {
        id: authUserId,
        email,
        social: false,
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
        })
        .eq('user_id', authUserId);

      if (stigmasUpdateResult.error) {
        console.error('stigmas 수정 실패:', stigmasUpdateResult.error);
        return Response.json({ error: 'stigmas 수정에 실패했습니다.' }, { status: 500 });
      }
    } else {
      const stigmasInsertResult = await supabaseAdmin.from('stigmas').insert({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_name: encryptedUserName,
        bio: null,
        avatar: null,
        user_id: authUserId,
        role: 'user',
        join_sites: null,
        email: encryptedEmail,
      });

      if (stigmasInsertResult.error) {
        console.error('stigmas 생성 실패:', stigmasInsertResult.error);
        return Response.json({ error: 'stigmas 생성에 실패했습니다.' }, { status: 500 });
      }
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    console.error('이메일 회원가입 처리 실패:', unknownError);
    return Response.json({ error: '이메일 회원가입 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
