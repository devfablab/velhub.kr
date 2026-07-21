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
            <h2>이용 제한</h2>
            <p>운영시 약관 위반 또는 대한민국 법 위반 소지가 확인되어 제한되었습니다.</p>
            <p>이의 신청 및 소명이 가능합니다.</p>
            <Anchor href="/concierge/rights" className="button medium submit">
              소명하기
            </Anchor>
          </div>
        </div>
      </div>
    </Container>
  );
}
