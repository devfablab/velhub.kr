import { redirect } from 'next/navigation';
import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';
import Opt from './opt';

export default async function Page() {
  let initialError = '';
  let existingHandleName = '';
  try {
    const response = await fetchApiRoute('/api/user/profile');
    const result = (await response.json()) as { user?: { handleName?: string }; message?: string };
    if (!response.ok) throw new Error(result.message ?? '독자 정보를 불러오지 못했습니다.');
    existingHandleName = result.user?.handleName ?? '';
  } catch (error) {
    initialError = error instanceof Error ? error.message : '독자 정보를 불러오지 못했습니다.';
  }
  if (existingHandleName) redirect(`/user/${existingHandleName}`);
  return <Opt initialReady={!initialError} initialError={initialError} />;
}
