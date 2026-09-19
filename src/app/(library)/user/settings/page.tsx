import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Opt from './opt';

export default async function Page() {
  let initialError = '';
  let existingHandleName = '';
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const response = await fetch(
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/user/profile`,
      { headers: { cookie: cookieStore.toString() }, cache: 'no-store' },
    );
    const result = (await response.json()) as { user?: { handleName?: string }; message?: string };
    if (!response.ok) throw new Error(result.message ?? '독자 정보를 불러오지 못했습니다.');
    existingHandleName = result.user?.handleName ?? '';
  } catch (error) {
    initialError = error instanceof Error ? error.message : '독자 정보를 불러오지 못했습니다.';
  }
  if (existingHandleName) redirect(`/user/${existingHandleName}`);
  return <Opt initialReady={!initialError} initialError={initialError} />;
}
