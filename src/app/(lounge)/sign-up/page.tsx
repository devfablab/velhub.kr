import EmailSignUpForm from '@/components/auth/EmailSignUpForm';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';

export default function Page() {
  return (
    <main>
      <h1>가입하기</h1>
      <EmailSignUpForm />
      <SocialLoginButtons />
    </main>
  );
}
