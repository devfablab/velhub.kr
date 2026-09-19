import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Headline from '../headline';
import Opt from './opt';
import styles from '@/app/settings.module.sass';

export const metadata: Metadata = {
  title: '개인 설정',
  description: '개인 설정 페이지',
};

export default async function Page() {
  let initialData: { profile?: { auto_login: boolean } } | null = null;
  let initialError = '';
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const response = await fetch(
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/info/advanced/user`,
      { headers: { cookie: cookieStore.toString() }, cache: 'no-store' },
    );
    const result = (await response.json()) as { profile?: { auto_login: boolean }; error?: string };
    if (!response.ok || !result.profile) throw new Error(result.error ?? '추가 설정 정보를 불러오지 못했습니다.');
    initialData = result;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '추가 설정 정보를 불러오지 못했습니다.';
  }
  return (
    <main>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <Headline page="advanced" />
          <Opt initialData={initialData} initialError={initialError} />
        </div>
      </div>
    </main>
  );
}
