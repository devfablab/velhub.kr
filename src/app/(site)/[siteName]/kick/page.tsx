import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import Container from '../menu';
import Anchor from '@/components/Anchor';
import styles from '@/app/board.module.sass';

export default function Page() {
  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper pape-error">
            <NearbyErrorRoundedIcon />
            <h2>강제 탈퇴 회원</h2>
            <p>원하시면 재가입이 가능합니다.</p>
          </div>
        </div>
      </div>
    </Container>
  );
}
