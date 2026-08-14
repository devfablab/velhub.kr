import { Metadata } from 'next';
import Container from '../container';
import EmailSignUp from './email';

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
