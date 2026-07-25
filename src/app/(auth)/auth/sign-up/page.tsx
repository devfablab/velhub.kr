import { Metadata } from 'next';
import EmailSignUp from './email';
import Container from '../container';

export const metadata: Metadata = {
  title: '회원가입 - 데브허브',
  description: '회원가입 페이지',
};

export default function Page() {
  return (
    <Container>
      <EmailSignUp />
    </Container>
  );
}
