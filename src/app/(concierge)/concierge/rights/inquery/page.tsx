import Container from '../../menu';
import styles from '@/app/concierge.module.sass';

export default function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>신고센터</h1>
          <section>
            <p>신고 내용</p>
          </section>
        </div>
      </div>
    </Container>
  );
}
