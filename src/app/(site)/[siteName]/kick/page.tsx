import { notFound } from 'next/navigation';
import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import { Stack, Typography } from '@mui/material';
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
            <h2>강제 탈퇴</h2>
            <Stack direction="column" gap={1}>
              <div className="paper">
                <Typography variant="subtitle2">강제 탈퇴 날짜</Typography>
                <Typography variant="body2">2027년 6월 12일</Typography>
              </div>
              <div className="paper">
                <Typography variant="subtitle2">강제 탈퇴 사유</Typography>
                <Typography variant="body2">블라블라</Typography>
              </div>
              <div className="paper">
                <Typography variant="subtitle2">재가입 가능 날짜</Typography>
                <Typography variant="body2">2027년 6월 13일</Typography>
              </div>
            </Stack>

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
