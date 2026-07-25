import { Stack } from '@mui/material';
import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import Anchor from '@/components/Anchor';

export default function NotFound() {
  return (
    <main>
      <div className="container">
        <div className="content">
          <div className="paper pape-error">
            <NearbyErrorRoundedIcon />
            <h2>NOT FOUND PAGE</h2>
            <p>삭제되었거나 존재하지 않는 페이지입니다.</p>
            <Stack direction="row" justifyContent="center">
              <Anchor href="/hub" className="button medium action">
                마이허브 홈으로 이동
              </Anchor>
            </Stack>
          </div>
        </div>
      </div>
    </main>
  );
}
