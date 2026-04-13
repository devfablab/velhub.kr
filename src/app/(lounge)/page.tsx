import styles from '../page.module.sass';
import AuthActions from '@/components/auth/AuthActions';
import SectionJoinSites from './home/sectionJoinSites';

export default function Home() {
  return (
    <main className={styles.main}>
      <AuthActions />
      <SectionJoinSites />
    </main>
  );
}
