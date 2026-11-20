import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../src/lib/encryption/decrypt.ts';
import { createLookupHash } from '../src/lib/encryption/encrypt.ts';
import { getDisplayNameLookupKey } from '../src/lib/users/displayName.ts';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const pageSize = 500;
let from = 0;
let updatedCount = 0;
let skippedCount = 0;

while (true) {
  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_name, withdrawal_status')
    .order('id')
    .range(from, from + pageSize - 1);

  if (stigmaResult.error) {
    throw stigmaResult.error;
  }

  const stigmas = stigmaResult.data ?? [];

  for (const stigma of stigmas) {
    let lookupHash = null;

    try {
      const userName = stigma.user_name ? decrypt(stigma.user_name) : '';
      const lookupKey = getDisplayNameLookupKey(userName);
      lookupHash = lookupKey && stigma.withdrawal_status !== 'completed' ? createLookupHash(lookupKey) : null;
    } catch {
      skippedCount += 1;
    }

    const updateResult = await supabaseAdmin
      .from('stigmas')
      .update({ user_name_lookup_hash: lookupHash })
      .eq('id', stigma.id);

    if (updateResult.error) {
      throw updateResult.error;
    }

    updatedCount += 1;
  }

  if (stigmas.length < pageSize) {
    break;
  }

  from += pageSize;
}

console.log(`updated: ${updatedCount}, skipped: ${skippedCount}`);
