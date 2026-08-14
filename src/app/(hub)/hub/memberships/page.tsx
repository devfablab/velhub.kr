import { Suspense } from 'react';
import { Metadata } from 'next';
import Container from '../menu';
import MembershipPlan from './opt';
import Content from './tab';

export const metadata: Metadata = {
  title: '멤버십 관리 - 마이허브 - 데브허브',
  description: '이용 중인 멤버십과 결제수단을 관리합니다.',
};

export default function Page() {
  return (
    <Container pageTitle="멤버십 관리" pageBack="/hub">
      <div className="container">
        <Content>
          <Suspense fallback={null}>
            <MembershipPlan />
          </Suspense>
        </Content>
      </div>
    </Container>
  );
}
