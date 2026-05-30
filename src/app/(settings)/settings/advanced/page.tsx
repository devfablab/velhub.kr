import Headline from '../headline';
import Opt from './opt';
import styles from '@/app/settings.module.sass';

export default function Page() {
  return (
    <main>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <Headline page="advanced" />
          <Opt />
        </div>
      </div>
    </main>
  );
}
