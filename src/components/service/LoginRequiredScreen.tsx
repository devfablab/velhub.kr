import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';

export default function LoginRequiredScreen() {
  return (
    <ScreenState
      kind="error"
      action={
        <Anchor href="/auth/sign-in" className="button medium action">
          로그인 하기
        </Anchor>
      }
    >
      로그인 후 이용할 수 있습니다.
    </ScreenState>
  );
}
