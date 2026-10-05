import { redirect } from 'next/navigation';
import { getBlogAdIdentityStatus, getBlogAdSiteContext } from '@/lib/blogAds/server';
import { normalizeText } from '@/lib/utils';
import Container from '../menu';
import Opt from './opt';

type Props = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: Props) {
  const siteName = normalizeText((await params).siteName).toLowerCase();
  const context = await getBlogAdSiteContext(siteName);
  if (!context || !context.isOwner) redirect(`/${siteName}/manage`);
  const identity = await getBlogAdIdentityStatus(context.session.stigmaId);

  return (
    <Container pageTitle="광고 관리" pageBack={`/${siteName}/manage`}>
      <Opt
        initialData={{
          isEnabled: context.isEnabled,
          isEligible: context.isEligible,
          hasBeenOpenFor15Days: context.hasBeenOpenFor15Days,
          postCount: context.postCount,
          totalViews: context.totalViews,
          ...identity,
        }}
      />
    </Container>
  );
}
