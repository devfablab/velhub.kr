'use client';

import { type JSX, useState } from 'react';
import { InputAdornment, Stack, TextField, Typography } from '@mui/material';
import {
  getRecoveryEmailErrorMessage,
  normalizeRecoveryEmail,
  normalizeRecoveryEmailCode,
  RECOVERY_EMAIL_CODE_LENGTH,
  RECOVERY_EMAIL_LABEL,
} from '@/lib/auth/recoveryEmail';
import { runInputAdornmentAction } from '@/lib/runInputAdornmentAction';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type RecoveryEmailFieldsProps = {
  email: string;
  code: string;
  accountEmail?: string;
  onEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  emailError?: string;
  codeError?: string;
  disabled?: boolean;
  onError: (message: string) => void;
};

export default function RecoveryEmailFields({
  email,
  code,
  accountEmail,
  onEmailChange,
  onCodeChange,
  emailError,
  codeError,
  disabled,
  onError,
}: RecoveryEmailFieldsProps) {
  const [sentEmail, setSentEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const normalizedEmail = normalizeRecoveryEmail(email);
  const isCodeSent = Boolean(sentEmail && sentEmail === normalizedEmail);

  async function handleSendCode() {
    if (isSending || disabled) return;

    const errorMessage = getRecoveryEmailErrorMessage(normalizedEmail, accountEmail);

    if (errorMessage) {
      onError(errorMessage);
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/auth/recovery-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'send', email: normalizedEmail }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !result?.ok) {
        onError(
          response.status >= 500 || !result?.error
            ? '확인 번호를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
            : result.error,
        );
        return;
      }

      setSentEmail(normalizedEmail);
      onCodeChange('');
    } catch {
      onError('확인 번호를 보내지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Stack gap={1}>
      <TextField
        name="recoveryEmail"
        placeholder={RECOVERY_EMAIL_LABEL}
        autoComplete="email"
        type="email"
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <button
                  type="button"
                  className="button small action"
                  onClick={handleSendCode}
                  disabled={!normalizedEmail || isSending || disabled}
                >
                  {isSending ? <LoadingIndicator size={20} /> : null}
                  {isCodeSent ? '다시 받기' : '확인 번호 받기'}
                </button>
              </InputAdornment>
            ),
          },
        }}
        value={email}
        onChange={(event: InputChangeEvent) => onEmailChange(event.currentTarget.value)}
        onKeyDown={(event) => runInputAdornmentAction(event, handleSendCode, !normalizedEmail || isSending)}
        error={Boolean(emailError)}
        helperText={
          emailError ||
          (accountEmail
            ? '로그인에 쓰는 계정 이메일과 다른 이메일을 입력해 주세요.'
            : '인증번호와 임시 보안 비밀번호를 받을 이메일입니다.')
        }
        fullWidth
        size="small"
        disabled={disabled}
      />
      {isCodeSent ? (
        <Stack gap={0.5}>
          <TextField
            name="recoveryEmailCode"
            placeholder="확인 번호 6자리"
            autoComplete="one-time-code"
            value={code}
            onChange={(event: InputChangeEvent) => onCodeChange(normalizeRecoveryEmailCode(event.currentTarget.value))}
            slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: RECOVERY_EMAIL_CODE_LENGTH } }}
            error={Boolean(codeError)}
            helperText={codeError}
            fullWidth
            size="small"
            disabled={disabled}
          />
          {codeError ? null : (
            <Typography variant="body2">이메일로 보낸 확인 번호를 10분 안에 입력해 주세요.</Typography>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
