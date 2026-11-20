import type { SupabaseClient } from '@supabase/supabase-js';
import { createLookupHash } from '@/lib/encryption/encrypt';
import { getDisplayNameLookupKey } from '@/lib/users/displayName';

export const DUPLICATE_ACTIVITY_NAME_MESSAGE = '이미 사용 중인 활동명입니다.';

export function createActivityNameLookupHash(activityName: string) {
  return createLookupHash(getDisplayNameLookupKey(activityName));
}

export async function isActivityNameTaken(
  supabaseAdmin: SupabaseClient,
  activityName: string,
  excludedUserId?: string | null,
) {
  let query = supabaseAdmin
    .from('stigmas')
    .select('id')
    .eq('user_name_lookup_hash', createActivityNameLookupHash(activityName))
    .limit(1);

  if (excludedUserId) {
    query = query.neq('user_id', excludedUserId);
  }

  const result = await query.maybeSingle();

  if (result.error) {
    throw new Error('활동명을 확인하지 못했습니다.');
  }

  return Boolean(result.data);
}
