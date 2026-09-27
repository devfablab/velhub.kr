import { isValidPassword, PASSWORD_REQUIREMENTS } from '@/lib/auth/password';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ACTIVITY_NAME_MIN_LENGTH = 2;
export const ACTIVITY_NAME_MAX_LENGTH = 10;

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
  const length = [...value.trim()].length;
  return length >= ACTIVITY_NAME_MIN_LENGTH && length <= ACTIVITY_NAME_MAX_LENGTH;
}

export function resolveActivityName(userName: string, email: string) {
  const normalizedUserName = userName.trim();

  if (normalizedUserName) {
    return isValidActivityName(normalizedUserName) ? normalizedUserName : null;
  }

  const emailLocalPart = getEmailLocalPart(email);
  return isValidActivityName(emailLocalPart) ? emailLocalPart : null;
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
  const userName = params.userName.trim();
  const emailLocalPart = getEmailLocalPart(email);
  const mustEnterActivityName = !isValidActivityName(emailLocalPart);
  const fieldErrors: EmailSignUpFieldErrors = {
    email: !email
      ? '이메일을 입력해 주세요.'
      : !EMAIL_PATTERN.test(email)
        ? '올바른 이메일 형식으로 입력해 주세요.'
        : '',
    userName:
      !userName && mustEnterActivityName
        ? '활동명은 2자 이상 10자 이하로 입력해 주세요.'
        : userName && !isValidActivityName(userName)
          ? '활동명은 2자 이상 10자 이하로 입력해 주세요.'
          : '',
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
    activityName: resolveActivityName(userName, email),
  };
}
