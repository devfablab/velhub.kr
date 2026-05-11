import { notFound } from 'next/navigation';
import { Box, Container } from '@mui/material';
import { getSupabaseAdmin } from '@/lib/supabase';
import Blog from './blog';
import Community from './community';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = siteName.trim().toLowerCase();

  if (!normalizedSiteName) {
    notFound();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select(
      'id, created_at, site_label, profile_picture, summary, site_type, plan_type, visibility_type, theme_type, is_shutdown',
    )
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    notFound();
  }

  const siteResult = await supabaseAdmin
    .from('sites')
    .select('updated_at, updated_by')
    .eq('site_id', rhizomeResult.data.id)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    notFound();
  }

  const sitesInfo = {
    rhizomes: rhizomeResult.data,
    sites: siteResult.data,
  };

  if (rhizomeResult.data.site_type === 'blog') {
    const blogInfo = await supabaseAdmin
      .from('blogs')
      .select('created_at, comment_provider')
      .eq('site_id', rhizomeResult.data.id)
      .maybeSingle();

    if (blogInfo.error || !blogInfo.data) {
      notFound();
    }

    return (
      <Container maxWidth="sm">
        <Box sx={{ py: 8 }}>
          <Blog sitesInfo={sitesInfo} blogInfo={blogInfo.data} />
        </Box>
      </Container>
    );
  }

  if (rhizomeResult.data.site_type === 'community') {
    const communityInfo = await supabaseAdmin
      .from('communities')
      .select('created_at, join_type, policy_post, policy_comment')
      .eq('site_id', rhizomeResult.data.id)
      .maybeSingle();

    if (communityInfo.error || !communityInfo.data) {
      notFound();
    }

    return <Community sitesInfo={sitesInfo} communityInfo={communityInfo.data} />;
  }

  notFound();
}
