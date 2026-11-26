import {
  ACTIVITY_NAME_MAX_LENGTH,
  ACTIVITY_NAME_MIN_LENGTH,
  getActivityNameErrorMessage,
} from '@/lib/auth/emailSignUp';
import {
  getRecoveryEmailErrorMessage,
  normalizeRecoveryEmail,
  normalizeRecoveryEmailCode,
  RECOVERY_EMAIL_CODE_LENGTH,
} from '@/lib/auth/recoveryEmail';
import { limitDisplayNameInput, normalizeDisplayName } from '@/lib/users/displayName';

export type SocialSignUpFieldErrors = {
  userName: string;
  recoveryEmail: string;
  recoveryEmailCode: string;
  isAgreeChild: string;
  isAgreeTerm: string;
  isAgreePrivacy: string;
};

export const EMPTY_SOCIAL_SIGN_UP_FIELD_ERRORS: SocialSignUpFieldErrors = {
  userName: '',
  recoveryEmail: '',
  recoveryEmailCode: '',
  isAgreeChild: '',
  isAgreeTerm: '',
  isAgreePrivacy: '',
};

export const SOCIAL_ACTIVITY_NAME_MIN_LENGTH = ACTIVITY_NAME_MIN_LENGTH;
export const SOCIAL_ACTIVITY_NAME_MAX_LENGTH = ACTIVITY_NAME_MAX_LENGTH;

export function getSocialActivityName(value: unknown, email: string, provider: string) {
  const providerName = limitDisplayNameInput(normalizeDisplayName(typeof value === 'string' ? value : ''));

  if (providerName || provider === 'naver') {
    return providerName;
  }

  return limitDisplayNameInput(normalizeDisplayName(email.split('@')[0] ?? ''));
}

export function validateSocialSignUpFields(params: {
  accountEmail: string;
  userName: string;
  recoveryEmail: string;
  recoveryEmailCode: string;
  isAgreeChild: boolean;
  isAgreeTerm: boolean;
  isAgreePrivacy: boolean;
}) {
  const userName = normalizeDisplayName(params.userName);
  const recoveryEmail = normalizeRecoveryEmail(params.recoveryEmail);
  const recoveryEmailCode = normalizeRecoveryEmailCode(params.recoveryEmailCode);
  const recoveryEmailError = getRecoveryEmailErrorMessage(recoveryEmail, params.accountEmail);
  const fieldErrors: SocialSignUpFieldErrors = {
    userName: getActivityNameErrorMessage(userName),
    recoveryEmail: recoveryEmailError,
    recoveryEmailCode:
      !recoveryEmailError && recoveryEmailCode.length !== RECOVERY_EMAIL_CODE_LENGTH
        ? '이메일로 받은 확인 번호 6자리를 입력해 주세요.'
        : '',
    isAgreeChild: params.isAgreeChild ? '' : '만 14세 이상 여부를 확인해 주세요.',
    isAgreeTerm: params.isAgreeTerm ? '' : '이용약관에 동의해 주세요.',
    isAgreePrivacy: params.isAgreePrivacy ? '' : '개인정보 수집 및 이용에 동의해 주세요.',
  };

  return {
    fieldErrors,
    messages: Object.values(fieldErrors).filter(Boolean),
    userName,
    recoveryEmail,
    recoveryEmailCode,
  };
}
