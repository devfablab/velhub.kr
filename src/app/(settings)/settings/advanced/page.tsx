import { Metadata } from 'next';
import Headline from '../headline';
import Opt from './opt';
import styles from '@/app/settings.module.sass';

export const metadata: Metadata = {
  title: '개인 설정',
  description: '개인 설정 페이지',
};

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
