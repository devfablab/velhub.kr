import crypto from 'crypto';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatar';

function decryptNullable(value: string | null | undefined) {
  if (!value) return null;

  try {
    return decrypt(value).trim() || null;
  } catch {
    return null;
  }
}

function getAvatarUrl(value: string | null | undefined) {
  const avatar = value?.trim();

  if (!avatar) return null;
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;

  const supabaseAdmin = getSupabaseAdmin();
  return supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(avatar).data.publicUrl || null;
}

function createMemberHash(memberId: string) {
  const secret = process.env.CHANNEL_WORKS_MEMBER_HASH_SECRET?.trim();

  if (!secret) return null;

  return crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(memberId).digest('hex');
}

export async function GET() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return Response.json({ member: null }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('email, payment_email, user_name, avatar')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return Response.json({ error: '회원 정보를 불러오지 못했습니다.' }, { status: 500 });
  }

  const memberId = sessionClaims.userId;
  const paymentEmail = decryptNullable(stigmaResult.data.payment_email);
  const email = paymentEmail || decryptNullable(stigmaResult.data.email);
  const name = decryptNullable(stigmaResult.data.user_name);
  const avatarUrl = getAvatarUrl(stigmaResult.data.avatar);
  const memberHash = createMemberHash(memberId);

  return Response.json(
    {
      member: {
        memberId,
        ...(memberHash ? { memberHash } : {}),
        profile: {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        },
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
