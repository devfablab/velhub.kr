import type { Metadata } from 'next';
import { Stack, Typography } from '@mui/material';
import { isAtLeast14 } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { originTitle, Seo } from '@/lib/seo';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import Anchor from '@/components/Anchor';
import Opt from './opt';
import styles from '@/app/memberships.module.sass';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `창작자 멤버십 가입 - ${originTitle}`,
    pageTitle: '창작자 멤버십 가입',
    pageDescription: '데브허브 창작자 멤버십을 선택해 주세요.',
    pageImg: `https://velhub.xyz/og-etc.webp?ts=${timestamp}`,
    pagePath: '/memberships/creator',
  });
}

export default async function Page() {
  const currentStigma = await getCurrentStigma();
  let isUnder14Age = false;

  if (currentStigma) {
    const identityResult = await getSupabaseAdmin()
      .from('chorogons')
      .select('birth_date, birth_date_dummy')
      .eq('user_id', currentStigma.stigmaId)
      .maybeSingle();

    if (!identityResult.error && identityResult.data) {
      isUnder14Age = !isAtLeast14(getChorogonBirthDate(identityResult.data));
    }
  }

  if (isUnder14Age) {
    return (
      <main className={styles['membership-error-page']}>
        <div className={styles['membership-container']}>
          <div className="paper">
            <Typography variant="h6">독자 멤버십 가입</Typography>
            <p className="alert warning">결제/구매는 데브허브 정책상 만 14세 이상부터 가능해요. 😭</p>
            <Stack direction="row" justifyContent="flex-end" gap={2}>
              <Anchor href="/" className="button medium action">
                라운지로 이동
              </Anchor>
            </Stack>
          </div>
        </div>
      </main>
    );
  }

  return <Opt />;
}
