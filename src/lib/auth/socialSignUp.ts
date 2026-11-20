import {
  ACTIVITY_NAME_MAX_LENGTH,
  ACTIVITY_NAME_MIN_LENGTH,
  EMAIL_PATTERN,
  getActivityNameErrorMessage,
} from '@/lib/auth/emailSignUp';
import { limitDisplayNameInput, normalizeDisplayName } from '@/lib/users/displayName';

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
  const providerName = limitDisplayNameInput(normalizeDisplayName(typeof value === 'string' ? value : ''));

  if (providerName || provider === 'naver') {
    return providerName;
  }

  return limitDisplayNameInput(normalizeDisplayName(email.split('@')[0] ?? ''));
}

export function validateSocialSignUpFields(params: {
  provider: string;
  userName: string;
  paymentEmail: string;
  isAgreeChild: boolean;
  isAgreeTerm: boolean;
  isAgreePrivacy: boolean;
}) {
  const userName = normalizeDisplayName(params.userName);
  const paymentEmail = params.paymentEmail.trim().toLowerCase();
  const needsPaymentEmail = params.provider === 'naver';
  const fieldErrors: SocialSignUpFieldErrors = {
    userName: getActivityNameErrorMessage(userName),
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
