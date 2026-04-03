import SocialLoginButtons from '@/components/auth/SocialLoginButtons';
import EmailSignIn from './emailSignIn';

export default function Page() {
  return (
    <main>
      <h1>로그인</h1>
      <EmailSignIn />
      <SocialLoginButtons />
    </main>
  );
}
