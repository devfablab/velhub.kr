import { getSiteApiData } from '../../getSiteApiData';
import Opt, { type StaffResponse } from './opt';

export default async function Page({ params }: { params: Promise<{ siteName: string }> }) {
  const { siteName } = await params;
  const initial = await getSiteApiData<StaffResponse>(`/api/manage?siteName=${encodeURIComponent(siteName)}`, '정보를 불러오지 못했습니다.');
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
