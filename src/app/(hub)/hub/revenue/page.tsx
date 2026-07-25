import { Metadata } from 'next';
import Container from '../menu';
import RevenueHub from './opt';

export const metadata: Metadata = {
  title: '수입/정산 - 마이허브 - 데브허브',
  description: '수입/정산',
};

export default function Page() {
  return (
    <Container pageTitle="수입/정산" pageBack="/hub">
      <RevenueHub />
    </Container>
  );
}
