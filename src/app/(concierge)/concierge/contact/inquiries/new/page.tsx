import { Metadata } from 'next';
import Container from '../../../menu';
import Opt from './opt';
import { Contact1, Contact2, Contact3, Contact4, Contact5, Contact6 } from './svgs';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '문의하기 - 데브허브',
  description: '데브허브 문의 접수',
};

export default function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>문의하기</h1>
          <Opt />
          <div className={`paper ${styles['help-paper']}`}>
            <div className="paper">
              <Contact1 />
            </div>
            <div className="paper">
              <Contact2 />
            </div>
            <div className="paper">
              <Contact3 />
            </div>
            <div className="paper">
              <Contact4 />
            </div>
            <div className="paper">
              <Contact5 />
            </div>
            <div className="paper">
              <Contact6 />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
