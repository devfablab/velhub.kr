import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import Container from '../menu';
import BillingButton from './bllingButton';
import styles from '@/app/board.module.sass';

export default function Page() {
  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper pape-error">
            <NearbyErrorRoundedIcon />
            <h2>요금제 결제 필요</h2>
            <p>요금제 결제를 진행하셔야 사이트를 운영하실 수 있습니다.</p>
            <div className={styles.button}>
              <BillingButton />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
