import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import InviteButton from '@/components/service/common/InviteButton';
import Container from '../menu';
import styles from '@/app/board.module.sass';

export default function Page() {
  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper pape-error">
            <NearbyErrorRoundedIcon />
            <h2>초대 전용 사이트</h2>
            <p>초대장이 있는 분만 이용이 가능합니다.</p>
            <InviteButton />
          </div>
        </div>
      </div>
    </Container>
  );
}
