import { EMAIL_PATTERN } from '@/lib/auth/emailSignUp';

export const RECOVERY_EMAIL_LABEL = '보안 비밀번호 복구용 이메일';
export const RECOVERY_EMAIL_CODE_LENGTH = 6;
export const RECOVERY_EMAIL_CODE_VALID_SECONDS = 60 * 10;

const PLACEHOLDER_EMAIL_DOMAIN = '@auth.velhub.local';

export function getUsableAccountEmail(email: string | null | undefined) {
  const normalizedEmail = (email ?? '').trim().toLowerCase();
  return normalizedEmail.endsWith(PLACEHOLDER_EMAIL_DOMAIN) ? '' : normalizedEmail;
}

export function normalizeRecoveryEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeRecoveryEmailCode(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '').slice(0, RECOVERY_EMAIL_CODE_LENGTH) : '';
}

export function getRecoveryEmailErrorMessage(email: string, accountEmail?: string | null) {
  if (!email) {
    return `${RECOVERY_EMAIL_LABEL}을 입력해 주세요.`;
  }

  if (!EMAIL_PATTERN.test(email)) {
    return '올바른 이메일 형식으로 입력해 주세요.';
  }

  if (accountEmail && email === accountEmail.trim().toLowerCase()) {
    return '로그인에 쓰는 계정 이메일과 다른 이메일을 입력해 주세요.';
  }

  return '';
}
