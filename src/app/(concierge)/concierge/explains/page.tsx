import Container from '../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export default function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>소명센터</h1>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
