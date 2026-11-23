import Opt, { Response } from '../opt';
import { GET as getUserLibrary } from '@/app/api/user/[handleName]/route';

type Props = { params: Promise<{ handleName: string }> };

export default async function Page({ params }: Props) {
  const { handleName } = await params;
  let initialData: Response | null = null;
  let initialError = '';

  try {
    const response = await getUserLibrary(
      new Request(`http://localhost/api/user/${encodeURIComponent(handleName)}?page=1&tab=following`),
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
