import { getSitePageMetadata } from '@/lib/seoSite';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export async function generateMetadata(context: RouteContext) {
  const { siteName } = await context.params;

  return getSitePageMetadata({
    siteName,
    pageTitle: '활동 정지',
    pagePath: '/block',
  });
}

export default function Page() {
  return <Opt />;
}
