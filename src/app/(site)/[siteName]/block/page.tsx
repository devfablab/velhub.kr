import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
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
            <h2>차단된 회원</h2>
            <p>소명은 컨시어지 - 권리보호센터에서 하실 수 있습니다.</p>
            <Anchor href="/concierge/rights" className="button medium submit">
              바로가기
            </Anchor>
          </div>
        </div>
      </div>
    </Container>
  );
}
