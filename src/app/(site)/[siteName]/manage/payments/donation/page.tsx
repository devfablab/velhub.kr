import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { detectAdult } from '@/lib/service/detectAdult';
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
  const isAdult = await detectAdult(siteName);
  return (
    <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage`} menu="payments">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {isAdult ? (
            <Opt />
          ) : (
            <div className="paper">
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>만 19세 미만은 본 사이트에서 수익창출을 하실 수 없습니다.</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
