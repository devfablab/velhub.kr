import { ServiceErrorIcon } from '@/components/Svgs';
import Container from '../menu';
import styles from '@/app/board.module.sass';

export default function Page() {
  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper page-error">
            <ServiceErrorIcon />
            <h2>운영 중단 사이트</h2>
            <p>현재 이용할 수 없는 사이트입니다.</p>
          </div>
        </div>
      </div>
    </Container>
  );
}
