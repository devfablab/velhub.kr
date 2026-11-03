import { Resend } from 'resend';

export function getResendClient() {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY가 설정되지 않았습니다.');
  }

  return new Resend(resendApiKey);
}

export function getMailFrom() {
  const mailFrom = process.env.RESEND_FROM_EMAIL;

  if (!mailFrom) {
    throw new Error('메일 발신 주소가 설정되지 않았습니다.');
  }

  return mailFrom;
}
