import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import { Stack, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';
import Container from '../menu';
import styles from '@/app/board.module.sass';

export default function Page() {
  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper pape-error">
            <NearbyErrorRoundedIcon />
            <h2>차단됨</h2>
            <Stack direction="column" gap={1}>
              <div className="paper">
                <Typography variant="subtitle2">차단일</Typography>
                <Typography variant="body2">2027년 6월 12일</Typography>
              </div>
              <div className="paper">
                <Typography variant="subtitle2">차단 사유</Typography>
                <Typography variant="body2">블라블라</Typography>
              </div>
            </Stack>
            <Anchor href="/concierge/rights" className="button medium submit">
              소명하기
            </Anchor>
          </div>
        </div>
      </div>
    </Container>
  );
}
