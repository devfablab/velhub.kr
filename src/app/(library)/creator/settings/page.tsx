import { redirect } from 'next/navigation';
import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';
import Opt from './opt';

export default async function Page() {
  let initialError = '';
  let existingHandleName = '';
  try {
    const response = await fetchApiRoute('/api/creator/profile');
    const result = (await response.json()) as { creator?: { handleName?: string }; message?: string };
    if (!response.ok) throw new Error(result.message ?? '작가 정보를 불러오지 못했습니다.');
    existingHandleName = result.creator?.handleName ?? '';
  } catch (error) {
    initialError = error instanceof Error ? error.message : '작가 정보를 불러오지 못했습니다.';
  }
  if (existingHandleName) redirect(`/creator/${existingHandleName}`);
  return <Opt initialReady={!initialError} initialError={initialError} />;
}
