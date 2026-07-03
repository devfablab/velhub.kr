import Container from './menu';
import Aside from './aside';
import styles from '@/app/concierge.module.sass';

export default async function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <section>
            <h2>제목</h2>
            <p>컨시어지 내용</p>
          </section>
        </div>
        <Aside />
      </div>
    </Container>
  );
}
