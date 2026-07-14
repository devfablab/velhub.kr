import { notFound } from 'next/navigation';
import { normalizeText } from '@/lib/utils';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/manage.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  if (!normalizedSiteName) {
    notFound();
  }
  return (
    <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage`} menu="payments">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
