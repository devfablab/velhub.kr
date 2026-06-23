'use client';

import { useSearchParams } from 'next/navigation';
import Content from '../tab';
import Container from '../../menu';
import styles from '@/app/hub.module.sass';

export default function Page() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message') || '결제 수단 추가가 취소되었거나 실패했습니다.';

  return (
    <Container pageTitle="결제 수단 추가 실패" pageBack="/hub/purchase">
      <div className="container">
        <Content>
          <section className={`paper ${styles.paper}`}>
            <p>{message}</p>
          </section>
        </Content>
      </div>
    </Container>
  );
}
