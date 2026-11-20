import { isValidPassword, PASSWORD_REQUIREMENTS } from '@/lib/auth/password';
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  getDisplayNameErrorMessage,
  isValidDisplayName,
  normalizeDisplayName,
} from '@/lib/users/displayName';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ACTIVITY_NAME_MIN_LENGTH = DISPLAY_NAME_MIN_LENGTH;
export const ACTIVITY_NAME_MAX_LENGTH = DISPLAY_NAME_MAX_LENGTH;

export type EmailSignUpFieldErrors = {
  email: string;
  userName: string;
  password: string;
  passwordConfirm: string;
  isAgreeChild: string;
  isAgreeTerm: string;
  isAgreePrivacy: string;
};

export const EMPTY_EMAIL_SIGN_UP_FIELD_ERRORS: EmailSignUpFieldErrors = {
  email: '',
  userName: '',
  password: '',
  passwordConfirm: '',
  isAgreeChild: '',
  isAgreeTerm: '',
  isAgreePrivacy: '',
};

export function getEmailLocalPart(email: string) {
  return email.split('@')[0]?.trim() ?? '';
}

export function isValidActivityName(value: string) {
  return isValidDisplayName(value);
}

export function getActivityNameErrorMessage(value: string) {
  return normalizeDisplayName(value) ? getDisplayNameErrorMessage(value, '활동명') : '활동명을 입력해 주세요.';
}

export function validateEmailSignUpFields(params: {
  email: string;
  userName: string;
  password: string;
  passwordConfirm: string;
  isAgreeChild: boolean;
  isAgreeTerm: boolean;
  isAgreePrivacy: boolean;
}) {
  const email = params.email.trim().toLowerCase();
  const userName = normalizeDisplayName(params.userName);
  const fieldErrors: EmailSignUpFieldErrors = {
    email: !email
      ? '이메일을 입력해 주세요.'
      : !EMAIL_PATTERN.test(email)
        ? '올바른 이메일 형식으로 입력해 주세요.'
        : '',
    userName: getActivityNameErrorMessage(userName),
    password: !params.password
      ? '비밀번호를 입력해 주세요.'
      : !isValidPassword(params.password)
        ? PASSWORD_REQUIREMENTS
        : '',
    passwordConfirm: !params.passwordConfirm
      ? '비밀번호 확인을 입력해 주세요.'
      : params.password !== params.passwordConfirm
        ? '비밀번호가 일치하지 않습니다.'
        : '',
    isAgreeChild: params.isAgreeChild ? '' : '만 14세 이상 여부를 확인해 주세요.',
    isAgreeTerm: params.isAgreeTerm ? '' : '이용약관에 동의해 주세요.',
    isAgreePrivacy: params.isAgreePrivacy ? '' : '개인정보 수집 및 이용에 동의해 주세요.',
  };

  return {
    fieldErrors,
    messages: Object.values(fieldErrors).filter(Boolean),
    activityName: userName,
  };
}
