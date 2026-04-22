'use client';

import { useEffect, useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

type HCaptchaProps = {
  onTokenChange: (token: string) => void;
  resetKey: number;
};

export default function HCaptchaBox({ onTokenChange, resetKey }: HCaptchaProps) {
  const captchaReference = useRef<HCaptcha>(null);

  const hCaptchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY!;

  useEffect(() => {
    if (!captchaReference.current) {
      return;
    }

    captchaReference.current.resetCaptcha();
    onTokenChange('');
  }, [resetKey, onTokenChange]);

  return (
    <HCaptcha
      ref={captchaReference}
      sitekey={hCaptchaSiteKey}
      onVerify={(token) => {
        onTokenChange(token);
      }}
      onExpire={() => {
        onTokenChange('');
      }}
      onError={() => {
        onTokenChange('');
      }}
    />
  );
}
