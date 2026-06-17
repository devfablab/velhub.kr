import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import Container from '../menu';
import styles from '@/app/board.module.sass';

export default function Page() {
  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper pape-error">
            <NearbyErrorRoundedIcon />
            <h2>운영 중단 사이트</h2>
            <p>해결될 떄까지 기다려 주세요.</p>
          </div>
        </div>
      </div>
    </Container>
  );
}
