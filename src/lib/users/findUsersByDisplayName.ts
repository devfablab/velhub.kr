import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export async function findUserIdsByDisplayName(siteId: string, displayName: string) {
  const normalizedDisplayName = normalizeText(displayName);

  if (!siteId || !normalizedDisplayName) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('user_id, nickname')
    .eq('site_id', siteId);

  if (membershipResult.error) {
    throw new Error('작성자 정보를 확인하지 못했습니다.');
  }

  const memberships = membershipResult.data ?? [];
  const memberIds = memberships.map((membership) => normalizeText(membership.user_id)).filter(Boolean);
  const matchedMemberIds = new Set(
    memberships
      .filter((membership) => normalizeText(membership.nickname) === normalizedDisplayName)
      .map((membership) => normalizeText(membership.user_id))
      .filter(Boolean),
  );

  if (memberIds.length === 0) {
    return [];
  }

  const stigmaResult = await supabaseAdmin.from('stigmas').select('id, user_name').in('id', memberIds);

  if (stigmaResult.error) {
    throw new Error('작성자 정보를 확인하지 못했습니다.');
  }

  (stigmaResult.data ?? []).forEach((stigma) => {
    try {
      if (normalizeText(decrypt(normalizeText(stigma.user_name))) === normalizedDisplayName) {
        matchedMemberIds.add(normalizeText(stigma.id));
      }
    } catch {
      // 활동명을 복호화할 수 없는 계정은 표시명 검색 결과에 포함하지 않습니다.
    }
  });

  return Array.from(matchedMemberIds);
}
