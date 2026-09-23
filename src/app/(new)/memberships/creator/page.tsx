import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { Stack, Typography } from '@mui/material';
import { isAtLeast14 } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { originTitle, Seo } from '@/lib/seo';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import Anchor from '@/components/Anchor';
import Opt, { type Eligibility, type MembershipStatusResponse } from './opt';
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

  const cookieStore = await cookies();
  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = host ? `${protocol}://${host}` : '';
  const requestHeaders = { cookie: cookieStore.toString() };

  async function load<T>(path: string, fallback: string): Promise<{ data: T | null; error: string }> {
    if (!baseUrl) {
      return { data: null, error: fallback };
    }

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: requestHeaders,
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as (T & { message?: string }) | null;

      if (!response.ok || !data) {
        throw new Error(data?.message || fallback);
      }

      return { data, error: '' };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : fallback };
    }
  }

  const [eligibility, membership] = await Promise.all([
    load<Eligibility>('/api/memberships/eligibility', '멤버십 이용 조건을 확인하지 못했습니다.'),
    load<MembershipStatusResponse>('/api/memberships', '멤버십 정보를 불러오지 못했습니다.'),
  ]);

  return (
    <Opt
      initialEligibility={eligibility.data}
      initialMembership={membership.data}
      initialError={eligibility.error || membership.error}
    />
  );
}
