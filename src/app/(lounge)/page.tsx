import styles from '../page.module.sass';
import AuthActions from '@/components/auth/AuthActions';

export default function Home() {
  return (
    <main className={styles.main}>
      <AuthActions />
    </main>
  );
}
