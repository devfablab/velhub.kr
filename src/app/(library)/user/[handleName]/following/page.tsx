import { cookies, headers } from 'next/headers';
import Opt, { Response } from '../opt';

type Props = { params: Promise<{ handleName: string }> };

export default async function Page({ params }: Props) {
  const { handleName } = await params;
  let initialData: Response | null = null;
  let initialError = '';

  try {
    const headerList = await headers();
    const cookieStore = await cookies();
    const response = await fetch(
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/user/${handleName}?page=1&tab=following`,
      { headers: { cookie: cookieStore.toString() }, cache: 'no-store' },
    );
    const result = (await response.json()) as Response & { message?: string };
    if (!response.ok) throw new Error(result.message ?? '유저 정보를 불러오지 못했습니다.');
    initialData = result;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '유저 정보를 불러오지 못했습니다.';
  }

  return <Opt handleName={handleName} initialData={initialData} initialError={initialError} />;
}
