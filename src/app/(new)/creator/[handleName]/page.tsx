import { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';
import Opt from './opt';

type Props = { params: Promise<{ handleName: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handleName } = await params;
  const normalizedHandleName = normalizeText(handleName).toLowerCase();
  const supabaseAdmin = getSupabaseAdmin();
  const creatorResult = await supabaseAdmin
    .from('creators')
    .select('user_id')
    .eq('handle_name', normalizedHandleName)
    .maybeSingle();

  if (creatorResult.data?.user_id) {
    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('user_name')
      .eq('id', creatorResult.data.user_id)
      .maybeSingle();

    if (stigmaResult.data?.user_name) {
      try {
        const decryptedName = decrypt(stigmaResult.data.user_name);
        const displayName = decryptedName.startsWith('naver_') ? handleName : decryptedName;
        return { title: `${displayName} 작가님의 서재` };
      } catch {
        return { title: `${handleName} 작가님의 서재` };
      }
    }
  }

  return { title: `${handleName} 작가님의 서재` };
}

export default async function Page({ params }: Props) {
  const { handleName } = await params;
  return <Opt handleName={handleName} />;
}
