import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import Opt from './opt';
import RecentTableList from '@/components/service/community/RecentTableList';
import PostCountTableList from '@/components/service/community/PostCountTableList';
import UserInfo from '@/components/service/community/UserInfo';

type RouteContext = {
  params: Promise<{
    siteName: string;
    boardName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    notFound();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    notFound();
  }

  const isCommunity = rhizomeResult.data.site_type === 'community';
  return (
    <main>
      <div className="container">
        {isCommunity ? (
          <aside>
            <SiteInfo />
            <TableList />
          </aside>
        ) : null}

        <Opt isCommunity={isCommunity} />

        {isCommunity ? (
          <aside>
            <UserInfo />
            <PostCountTableList />
            <RecentTableList />
          </aside>
        ) : null}
      </div>
    </main>
  );
}
