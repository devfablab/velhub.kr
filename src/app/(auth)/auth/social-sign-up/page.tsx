import { Metadata } from 'next';
import Container from '../container';
import Opt from './opt';

export const metadata: Metadata = {
  title: '회원가입 - 데브허브',
  description: '소셜 회원가입 페이지',
};

export default function Page() {
  return (
    <Container>
      <Opt />
    </Container>
  );
}
