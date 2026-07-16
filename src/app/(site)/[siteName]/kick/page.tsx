import { notFound } from 'next/navigation';
import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import { getSupabaseAdmin } from '@/lib/supabase';
import Anchor from '@/components/Anchor';
import Container from '../menu';
import styles from '@/app/board.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const supabaseAdmin = getSupabaseAdmin();
  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select(
      'id, created_at, site_label, profile_picture, summary, site_type, plan_type, visibility_type, theme_type, is_shutdown',
    )
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    notFound();
  }

  const rhizome = rhizomeResult.data;

  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper pape-error">
            <NearbyErrorRoundedIcon />
            <h2>강제 탈퇴 회원</h2>
            <p>원하시면 재가입이 가능합니다.</p>
            {rhizome.site_type === 'community' ? (
              <Anchor href={`/${siteName}/join`} className="button medium submit">
                가입하기
              </Anchor>
            ) : null}
          </div>
        </div>
      </div>
    </Container>
  );
}
