import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encrypt } from '@/lib/encryption/encrypt';
import { decrypt } from '@/lib/encryption/decrypt';

type RequestBody = {
  userName: string;
  avatar: string;
  bio: string;
};

const AVATAR_BUCKET = 'avatar';
const SUPABASE_AVATAR_PREFIX = 'supabase:';

function isSupabaseAvatarValue(value: string) {
  return value.startsWith(SUPABASE_AVATAR_PREFIX);
}

function getSupabaseAvatarPath(value: string) {
  return value.replace(SUPABASE_AVATAR_PREFIX, '').trim();
}

function getSupabaseAvatarPublicUrl(path: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const publicUrlResult = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return publicUrlResult.data.publicUrl ?? '';
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('user_name, bio, avatar')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '기본정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const rawAvatarValue = stigmaResult.data.avatar ?? '';

    let avatarUrl = '';

    if (rawAvatarValue) {
      if (isSupabaseAvatarValue(rawAvatarValue)) {
        const avatarPath = getSupabaseAvatarPath(rawAvatarValue);
        avatarUrl = avatarPath ? getSupabaseAvatarPublicUrl(avatarPath) : '';
      } else {
        avatarUrl = rawAvatarValue;
      }
    }

    return Response.json({
      userName: stigmaResult.data.user_name ? decrypt(stigmaResult.data.user_name) : '',
      bio: stigmaResult.data.bio ? decrypt(stigmaResult.data.bio) : '',
      avatar: rawAvatarValue,
      avatarUrl,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '기본정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '기본정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const userName = requestBody.userName.trim();
    const avatar = requestBody.avatar.trim();
    const bio = requestBody.bio.trim();

    if (!userName) {
      return Response.json({ error: '활동명을 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaUpdateResult = await supabaseAdmin
      .from('stigmas')
      .update({
        user_name: encrypt(userName),
        bio: bio ? encrypt(bio) : null,
        avatar: avatar || null,
      })
      .eq('user_id', sessionClaims.userId);

    if (stigmaUpdateResult.error) {
      return Response.json({ error: '기본정보 수정에 실패했습니다.' }, { status: 500 });
    }

    const authUserResult = await supabaseAdmin.auth.admin.getUserById(sessionClaims.userId);

    if (authUserResult.error || !authUserResult.data.user) {
      return Response.json({ error: '인증 사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const currentMetadata = (authUserResult.data.user.user_metadata ?? {}) as Record<string, unknown>;

    const avatarUrl =
      avatar && isSupabaseAvatarValue(avatar)
        ? getSupabaseAvatarPublicUrl(getSupabaseAvatarPath(avatar))
        : avatar || null;

    const authUpdateResult = await supabaseAdmin.auth.admin.updateUserById(sessionClaims.userId, {
      user_metadata: {
        ...currentMetadata,
        user_name: userName,
        name: userName,
        full_name: userName,
        preferred_username: userName,
        avatar_url: avatarUrl,
        picture: avatarUrl,
        avatar: avatarUrl,
      },
    });

    if (authUpdateResult.error) {
      return Response.json({ error: '인증 사용자 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      userName,
      bio,
      avatar,
      avatarUrl: avatarUrl ?? '',
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '기본정보 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '기본정보 수정에 실패했습니다.' }, { status: 500 });
  }
}
