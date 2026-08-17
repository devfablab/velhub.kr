import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { detectAdult } from '@/lib/service/detectAdult';
import { getAuthorState } from '@/lib/session/author';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import Container from '../../menu';
import BlogSubscription from './blog';
import SeriesSubscriptions from './series';
import styles from '@/app/manage.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const supabaseAdmin = getSupabaseAdmin();
  const siteInfo = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type, owner_id')
    .eq('site_key', siteName)
    .maybeSingle();
  const site = siteInfo.data;
  const isBlog = site?.site_type === 'blog';
  const [blogInfo, authorState, session, isAdult] = await Promise.all([
    isBlog ? supabaseAdmin.from('blogs').select('blog_type').eq('site_id', site.id).maybeSingle() : null,
    isBlog ? getAuthorState(site.owner_id) : null,
    site ? verifySession({ siteId: site.id }) : null,
    isBlog ? true : detectAdult(siteName),
  ]);
  const isTeamBlog = blogInfo?.data?.blog_type === 'team';
  const isOwner = Boolean(site && session?.stigmaId === site.owner_id);

  function getBlogUnavailableMessage() {
    if (authorState?.isSettlementError) {
      return isOwner
        ? '연재 구독을 열려면 작가 승인 상태와 정산정보를 확인해 주세요.'
        : '연재 구독을 열려면 블로그 운영자의 작가 승인 상태와 정산정보가 정상이어야 합니다.';
    }

    return isOwner
      ? '연재 구독을 열려면 먼저 작가 신청을 완료해 주세요.'
      : '연재 구독을 열려면 블로그 운영자가 작가 승인을 완료해야 합니다.';
  }

  function getBlogGuidanceMessages() {
    const authorCondition = isOwner
      ? '연재 구독을 열려면 작가로 승인되어 있어야 합니다. 구독 수익은 블로그 운영자에게 정산됩니다.'
      : '연재 구독을 열려면 블로그 운영자가 작가로 승인되어 있어야 합니다. 구독 수익은 블로그 운영자에게 정산됩니다.';
    const seriesPrice = '연재 구독료는 7,000원부터 100,000원까지 1,000원 단위로 설정할 수 있습니다.';

    if (isTeamBlog) {
      return [authorCondition, '팀 블로그는 블로그 구독을 운영할 수 없으며, 연재 구독만 열 수 있습니다.', seriesPrice];
    }

    return [
      authorCondition,
      '블로그 구독과 연재 구독을 함께 운영하면 연재 구독료는 블로그 구독료의 70% 이하로 설정해야 합니다.',
      seriesPrice,
    ];
  }

  const canManageBlogSubscriptions = isBlog && authorState?.isAuthor === true;
  return (
    <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage`} menu="payments">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {canManageBlogSubscriptions ? (
            <>
              {!isTeamBlog ? <BlogSubscription /> : null}
              <SeriesSubscriptions guidanceMessages={getBlogGuidanceMessages()} />
            </>
          ) : isBlog ? (
            <div className="paper">
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>{getBlogUnavailableMessage()}</span>
              </p>
            </div>
          ) : isAdult ? (
            <SeriesSubscriptions />
          ) : (
            <div className="paper">
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>본 커뮤니티에서는 수익을 창출할 수 없습니다.</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
