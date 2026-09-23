import crypto from 'crypto';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatar';

export type ChannelWorksMember = {
  memberId: string;
  memberHash?: string;
  profile: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
};

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

  return getSupabaseAdmin().storage.from(AVATAR_BUCKET).getPublicUrl(avatar).data.publicUrl || null;
}

function createMemberHash(memberId: string) {
  const secret = process.env.CHANNEL_WORKS_MEMBER_HASH_SECRET?.trim();

  if (!secret) return null;

  return crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(memberId).digest('hex');
}

export async function getChannelWorksMember(): Promise<ChannelWorksMember | null> {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) return null;

  const stigmaResult = await getSupabaseAdmin()
    .from('stigmas')
    .select('email, payment_email, user_name, avatar')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) return null;

  const memberId = sessionClaims.userId;
  const paymentEmail = decryptNullable(stigmaResult.data.payment_email);
  const email = paymentEmail || decryptNullable(stigmaResult.data.email);
  const name = decryptNullable(stigmaResult.data.user_name);
  const avatarUrl = getAvatarUrl(stigmaResult.data.avatar);
  const memberHash = createMemberHash(memberId);

  return {
    memberId,
    ...(memberHash ? { memberHash } : {}),
    profile: {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
    },
  };
}
