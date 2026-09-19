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
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/creator/profile`,
      { headers: { cookie: cookieStore.toString() }, cache: 'no-store' },
    );
    const result = (await response.json()) as { creator?: { handleName?: string }; message?: string };
    if (!response.ok) throw new Error(result.message ?? '작가 정보를 불러오지 못했습니다.');
    existingHandleName = result.creator?.handleName ?? '';
  } catch (error) {
    initialError = error instanceof Error ? error.message : '작가 정보를 불러오지 못했습니다.';
  }
  if (existingHandleName) redirect(`/creator/${existingHandleName}`);
  return <Opt initialReady={!initialError} initialError={initialError} />;
}
