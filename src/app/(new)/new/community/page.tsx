import Opt from './opt';
import styles from '@/app/new.module.sass';

export default async function Page() {
  return (
    <main className={styles['new-generation']}>
      <div className={styles.container}>
        <div className={`content ${styles.content}`}>
          <h1>커뮤니티 개설</h1>
          <Opt />
        </div>
      </div>
    </main>
  );
}
