import styles from '../page.module.sass';
import AuthActions from '@/components/auth/AuthActions';
import SectionJoinSites from './home/sectionJoinSites';
import SectionPendingInvites from './home/sectionPendingInvites';

export default function Home() {
  return (
    <main className={styles.main}>
      <AuthActions />
      <SectionPendingInvites />
      <SectionJoinSites />
    </main>
  );
}
