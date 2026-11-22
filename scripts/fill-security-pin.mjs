import { createClient } from '@supabase/supabase-js';
import { createLookupHash } from '../src/lib/encryption/encrypt.ts';

const DEFAULT_SECURITY_PIN = '110857';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const stigmaResult = await supabaseAdmin.from('stigmas').select('id, user_id').is('security_pin_hash', null);

if (stigmaResult.error) {
  throw stigmaResult.error;
}

let updatedCount = 0;

for (const stigma of stigmaResult.data ?? []) {
  if (!stigma.user_id) {
    continue;
  }

  const updateResult = await supabaseAdmin
    .from('stigmas')
    .update({ security_pin_hash: createLookupHash(`security-pin:${stigma.user_id}:${DEFAULT_SECURITY_PIN}`) })
    .eq('id', stigma.id);

  if (updateResult.error) {
    throw updateResult.error;
  }

  updatedCount += 1;
}

console.log(`updated: ${updatedCount}`);
