import { redirect } from 'next/navigation';
import { Typography } from '@mui/material';
import { getSupabaseAdmin } from '@/lib/supabase';
import Opt from './opt';
import Container from '../menu';

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

  return (
    <Container pageBack={`/${siteName}`} pageTitle="가입하기">
      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          <Typography variant="h6" component="h2" sx={{ marginBottom: 2 }}>
            커뮤니티 가입
          </Typography>
          <div className="paper" style={{ marginTop: 12 }}>
            <Opt siteName={normalizedSiteName} />
          </div>
        </div>
      </div>
    </Container>
  );
}
