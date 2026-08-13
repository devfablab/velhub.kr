'use client';

import { useState } from 'react';
import PortOne from '@portone/browser-sdk/v2';
import { Snackbar } from '@mui/material';
import IdentityAgreement from '@/components/service/common/IdentityAgreement';

type IdentityVerificationRequest = {
  storeId: string;
  channelKey: string;
  identityVerificationId: string;
};

type IdentityVerificationSuccessResponse = {
  name: string;
  birth_date: string;
  gender: string;
};

type Props = {
  onVerified?: (identity: IdentityVerificationSuccessResponse) => void;
  className?: string;
  children?: React.ReactNode;
};

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : '요청 처리에 실패했습니다.';
}

function isMessageResponse(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

async function sendJson<T>(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    throw new Error(isMessageResponse(data) ? data.message : '요청 처리에 실패했습니다.');
  }

  return data as T;
}

export default function IdentityVerificationButton({
  onVerified,
  className = 'button small submit',
  children = '본인인증',
}: Props) {
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const handleVerify = async () => {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      const request = await sendJson<IdentityVerificationRequest>('/api/identity/portone/start');
      const result = await PortOne.requestIdentityVerification(request);
      const identityVerificationId = result?.identityVerificationId ?? request.identityVerificationId;

      if (!identityVerificationId || result?.code) {
        await sendJson('/api/identity/portone/fail', {
          identityVerificationId: request.identityVerificationId,
          code: result?.code,
          message: result?.message,
        });
        throw new Error(result?.message || '본인인증이 완료되지 않았습니다.');
      }

      const identity = await sendJson<IdentityVerificationSuccessResponse>('/api/identity/portone/success', {
        identityVerificationId,
      });
      setAgreementOpen(false);
      setMessage('본인인증이 완료되었습니다.');

      if (onVerified) {
        onVerified(identity);
      } else {
        window.location.reload();
      }
    } catch (error) {
      setMessage(getMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAgreementConfirm = async () => {
    try {
      await sendJson('/api/identity/agreement', { type: 'identity' });
      await handleVerify();
    } catch (error) {
      setMessage(getMessage(error));
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={() => setAgreementOpen(true)} disabled={isProcessing}>
        {isProcessing ? '처리 중' : children}
      </button>
      <IdentityAgreement
        type="identity"
        open={agreementOpen}
        onClose={() => setAgreementOpen(false)}
        onConfirm={() => void handleAgreementConfirm()}
      />
      <Snackbar
        open={Boolean(message)}
        message={message}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        autoHideDuration={2700}
        onClose={() => setMessage('')}
        sx={{ zIndex: 20002 }}
      />
    </>
  );
}
