import { redirect } from 'next/navigation';
import { Typography } from '@mui/material';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getSiteApiData } from '../../getSiteApiData';
import Container from '../menu';
import Opt, { type JoinResponse } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizome.data?.site_type !== 'community') {
    redirect(`/${normalizedSiteName}`);
  }

  const initial = await getSiteApiData<JoinResponse>(
    `/api/manage/join/conditions?siteName=${normalizedSiteName}`,
    '가입 정보를 불러오지 못했습니다.',
  );

  return (
    <Container pageBack={`/${siteName}`} pageTitle="가입하기">
      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          <Typography variant="h6" component="h2" sx={{ marginBottom: 2 }}>
            커뮤니티 가입
          </Typography>
          <div className="paper" style={{ marginTop: 12 }}>
            <Opt siteName={normalizedSiteName} initialData={initial.data} initialError={initial.error} />
          </div>
        </div>
      </div>
    </Container>
  );
}
