import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { detectAdult } from '@/lib/service/detectAdult';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
import Container from '../../menu';
import Opt, { type DonationManageResponse } from './opt';
import styles from '@/app/manage.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const isAdult = await detectAdult(siteName);
  const supabaseAdmin = getSupabaseAdmin();
  const siteInfo = await supabaseAdmin.from('rhizomes').select('site_type').eq('site_key', siteName).maybeSingle();
  const initial = isAdult
    ? await getSiteApiData<DonationManageResponse>(`/api/manage/payments/donation?siteName=${siteName}`, '후원 내역을 불러오지 못했습니다.')
    : null;

  return (
    <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage`} menu="payments">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {isAdult ? (
            <Opt initialData={initial?.data ?? null} initialError={initial?.error ?? ''} />
          ) : (
            <div className="paper">
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>
                  본 {siteInfo.data?.site_type === 'blog' ? '블로그' : '커뮤니티'}에서는 수익을 창출할 수 없습니다.
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
