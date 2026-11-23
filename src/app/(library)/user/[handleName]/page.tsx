import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';
import Opt, { Response } from './opt';
import { GET as getUserLibrary } from '@/app/api/user/[handleName]/route';

type Props = { params: Promise<{ handleName: string }>; searchParams: Promise<{ tab?: string }> };

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

export default async function Page({ params, searchParams }: Props) {
  const { handleName } = await params;
  const { tab } = await searchParams;
  if (tab === 'following') redirect(`/user/${handleName}/following`);
  let initialData: Response | null = null;
  let initialError = '';
  try {
    const response = await getUserLibrary(
      new Request(`http://localhost/api/user/${encodeURIComponent(handleName)}?page=1`),
      {
        params: Promise.resolve({ handleName }),
      },
    );
    const result = (await response.json()) as Response & { message?: string };
    if (!response.ok) throw new Error(result.message ?? '유저 정보를 불러오지 못했습니다.');
    initialData = result;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '유저 정보를 불러오지 못했습니다.';
  }
  return <Opt handleName={handleName} initialData={initialData} initialError={initialError} />;
}
