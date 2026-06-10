import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type AccountRow = {
  email: string | null;
  user_name: string | null;
  avatar: string | null;
};

function decryptValue(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    const decryptedValue = decrypt(normalizedValue);

    if (decryptedValue.startsWith('naver_')) {
      return null;
    }

    return decryptedValue;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const accountResult = await supabaseAdmin
      .from('stigmas')
      .select('email, user_name, avatar')
      .eq('user_id', session.authUserId)
      .maybeSingle();

    if (accountResult.error || !accountResult.data) {
      return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const account = accountResult.data as AccountRow;

    return Response.json({
      isLoggedIn: true,
      email: decryptValue(account.email),
      userName: decryptValue(account.user_name),
      avatar: account.avatar ?? null,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
