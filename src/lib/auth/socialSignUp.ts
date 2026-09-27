import {
  ACTIVITY_NAME_MAX_LENGTH,
  ACTIVITY_NAME_MIN_LENGTH,
  EMAIL_PATTERN,
  isValidActivityName,
} from '@/lib/auth/emailSignUp';

export type SocialSignUpFieldErrors = {
  userName: string;
  paymentEmail: string;
  isAgreeChild: string;
  isAgreeTerm: string;
  isAgreePrivacy: string;
};

export const EMPTY_SOCIAL_SIGN_UP_FIELD_ERRORS: SocialSignUpFieldErrors = {
  userName: '',
  paymentEmail: '',
  isAgreeChild: '',
  isAgreeTerm: '',
  isAgreePrivacy: '',
};

export const SOCIAL_ACTIVITY_NAME_MIN_LENGTH = ACTIVITY_NAME_MIN_LENGTH;
export const SOCIAL_ACTIVITY_NAME_MAX_LENGTH = ACTIVITY_NAME_MAX_LENGTH;

export function getSocialActivityName(value: unknown, email: string, provider: string) {
  const providerName = typeof value === 'string' ? value.trim() : '';

  if (isValidActivityName(providerName)) {
    return providerName;
  }

  if (provider === 'naver') {
    return '';
  }

  const emailLocalPart = email.split('@')[0]?.trim() ?? '';
  return isValidActivityName(emailLocalPart) ? emailLocalPart : '';
}

export function validateSocialSignUpFields(params: {
  provider: string;
  userName: string;
  paymentEmail: string;
  isAgreeChild: boolean;
  isAgreeTerm: boolean;
  isAgreePrivacy: boolean;
}) {
  const userName = params.userName.trim();
  const paymentEmail = params.paymentEmail.trim().toLowerCase();
  const needsPaymentEmail = params.provider === 'naver';
  const fieldErrors: SocialSignUpFieldErrors = {
    userName: !userName
      ? '활동명을 입력해 주세요.'
      : !isValidActivityName(userName)
        ? '활동명은 2자 이상 10자 이하로 입력해 주세요.'
        : '',
    paymentEmail: needsPaymentEmail
      ? !paymentEmail
        ? '이메일을 입력해 주세요.'
        : !EMAIL_PATTERN.test(paymentEmail)
          ? '올바른 이메일 형식으로 입력해 주세요.'
          : ''
      : '',
    isAgreeChild: params.isAgreeChild ? '' : '만 14세 이상 여부를 확인해 주세요.',
    isAgreeTerm: params.isAgreeTerm ? '' : '이용약관에 동의해 주세요.',
    isAgreePrivacy: params.isAgreePrivacy ? '' : '개인정보 수집 및 이용에 동의해 주세요.',
  };

  return {
    fieldErrors,
    messages: Object.values(fieldErrors).filter(Boolean),
    userName,
    paymentEmail,
  };
}
