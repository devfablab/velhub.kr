import { Metadata } from 'next';
import { headers } from 'next/headers';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Opt, { Response } from './opt';

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
        return { title: `${displayName} 독자의 서재` };
      } catch {
        return { title: `${handleName} 독자의 서재` };
      }
    }
  }

  return { title: `${handleName} 독자의 서재` };
}

export default async function Page({ params }: Props) {
  const { handleName } = await params;
  let initialData: Response | null = null;
  let initialError = '';
  try {
    const headerList = await headers();
    const response = await fetch(
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/user/${handleName}?page=1`,
      { cache: 'no-store' },
    );
    const result = (await response.json()) as Response & { message?: string };
    if (!response.ok) throw new Error(result.message ?? '유저 정보를 불러오지 못했습니다.');
    initialData = result;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '유저 정보를 불러오지 못했습니다.';
  }
  return <Opt handleName={handleName} initialData={initialData} initialError={initialError} />;
}
