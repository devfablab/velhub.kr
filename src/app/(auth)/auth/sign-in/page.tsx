import { Metadata } from 'next';
import Container from '../container';
import EmailSignIn from './email';

export const metadata: Metadata = {
  title: '로그인',
  description: '로그인 페이지',
};

export default function Page() {
  return (
    <Container>
      <EmailSignIn />
    </Container>
  );
}
