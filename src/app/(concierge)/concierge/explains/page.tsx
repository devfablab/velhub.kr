import { Metadata } from 'next';
import { headers } from 'next/headers';
import { Stack } from '@mui/material';
import { loadAppealCenterItems } from '@/lib/reports/appealCenterServer';
import type { AppealCenterItem } from '@/lib/reports/appeals';
import { getCurrentStigma } from '@/lib/session/utils';
import Anchor from '@/components/Anchor';
import Container from '../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '소명센터 - 데브허브',
  description: '소명센터',
};

export default async function Page() {
  const current = await getCurrentStigma();
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  let initialItems: AppealCenterItem[] = [];
  let initialError = '';

  if (current && host) {
    try {
      initialItems = await loadAppealCenterItems({ stigmaId: current.stigmaId, origin: `${protocol}://${host}` });
    } catch (unknownError) {
      initialError = unknownError instanceof Error ? unknownError.message : '소명 내역을 불러오지 못했습니다.';
    }
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <Stack direction="row" justifyContent="space-between">
            <h1>소명센터</h1>
            <Anchor href="/concierge/explains/guidelines" className="button small action">
              가이드라인 소명 보기
            </Anchor>
          </Stack>
          <Opt initialItems={initialItems} initialError={initialError} initialLoginRequired={!current} />
        </div>
      </div>
    </Container>
  );
}
