import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';

function isMinorAge(birthDate: string | null | undefined) {
  if (!birthDate) return false;
  const digits = birthDate.replace(/\D/g, '');
  if (digits.length !== 8) return false;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));

  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);

  let age = today.getFullYear() - year;
  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age < 19;
}

export async function getAuthorState(stigmaId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const identityResult = await supabaseAdmin
    .from('chorogons')
    .select('id, birth_date')
    .eq('user_id', stigmaId)
    .maybeSingle();

  if (identityResult.error || !identityResult.data) {
    return { isAuthor: false };
  }

  const settlementResult = await supabaseAdmin
    .from('chorogons_banque')
    .select('is_author, is_guardian_approved')
    .eq('chorogon_id', identityResult.data.id)
    .maybeSingle();

  if (!settlementResult.data || !settlementResult.data.is_author) {
    return { isAuthor: false };
  }

  const identityBirthDate = identityResult.data.birth_date ? decrypt(String(identityResult.data.birth_date)) : null;
  const isMinor = isMinorAge(identityBirthDate);

  if (isMinor && settlementResult.data.is_guardian_approved !== true) {
    return { isAuthor: false };
  }

  return { isAuthor: true };
}
