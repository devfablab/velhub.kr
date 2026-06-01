import Container from './menu';
import AuthActions from '@/components/auth/AuthActions';
import styles from '../page.module.sass';

export default function Home() {
  return (
    <Container>
      <AuthActions />
    </Container>
  );
}
