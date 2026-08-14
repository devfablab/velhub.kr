import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import { Stack } from '@mui/material';
import Anchor from '@/components/Anchor';

export default function NotFound() {
  return (
    <main>
      <div className="container">
        <div className="content">
          <div className="paper page-error">
            <NearbyErrorRoundedIcon />
            <h2>NOT FOUND PAGE</h2>
            <p>삭제되었거나 존재하지 않는 페이지입니다.</p>
            <Stack direction="row" justifyContent="center">
              <Anchor href="/concierge" className="button medium action">
                컨시어지 홈으로 이동
              </Anchor>
            </Stack>
          </div>
        </div>
      </div>
    </main>
  );
}
