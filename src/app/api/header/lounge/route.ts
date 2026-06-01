import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type ThemeMode = 'light' | 'system' | 'dark';

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
    return decrypt(normalizedValue);
  } catch {
    return null;
  }
}

function getPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? null;
}

function processAvatar(avatar: string | null) {
  if (!avatar) {
    return null;
  }

  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }

  return getPublicUrl('avatar', avatar);
}

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({
        isLoggedIn: false,
        email: null,
        userName: null,
        avatar: null,
      });
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

    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('theme_mode')
      .eq('user_id', session.authUserId)
      .maybeSingle();

    if (profileResult.error) {
      return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const account = accountResult.data as AccountRow;

    return Response.json({
      isLoggedIn: true,
      email: decryptValue(account.email),
      userName: decryptValue(account.user_name),
      avatar: processAvatar(account.avatar),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '헤더 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
