'use client';

import { type ClipboardEvent, type CSSProperties, type KeyboardEvent, useRef } from 'react';
import { Stack } from '@mui/material';
import { normalizeSecurityPin, SECURITY_PIN_LENGTH } from '@/lib/auth/securityPin';

type SecurityPinInputProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  onComplete?: () => void;
};

export default function SecurityPinInput({
  value,
  onChange,
  label,
  disabled,
  error,
  autoFocus,
  onComplete,
}: SecurityPinInputProps) {
  const inputReferences = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: SECURITY_PIN_LENGTH }, (_, index) => value[index] ?? '');

  function focusInput(index: number) {
    const input = inputReferences.current[Math.max(0, Math.min(SECURITY_PIN_LENGTH - 1, index))];
    input?.focus();
    input?.select();
  }

  function updateDigits(startIndex: number, nextText: string) {
    const nextDigits = [...digits];
    const insertedDigits = normalizeSecurityPin(nextText).split('');

    insertedDigits.forEach((digit, offset) => {
      if (startIndex + offset < SECURITY_PIN_LENGTH) {
        nextDigits[startIndex + offset] = digit;
      }
    });

    const nextValue = nextDigits.join('').slice(0, SECURITY_PIN_LENGTH);
    onChange(nextValue);

    return {
      insertedCount: insertedDigits.length,
      isCompleted:
        insertedDigits.length > 0 &&
        startIndex + insertedDigits.length >= SECURITY_PIN_LENGTH &&
        nextValue.length === SECURITY_PIN_LENGTH,
    };
  }

  function handleChange(index: number, nextValue: string) {
    if (!nextValue) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      onChange(nextDigits.join(''));
      return;
    }

    const { insertedCount, isCompleted } = updateDigits(index, nextValue.replace(digits[index], '') || nextValue);

    if (insertedCount > 0) {
      focusInput(index + insertedCount);
    }

    if (isCompleted) {
      onComplete?.();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const nextDigits = [...digits];
      nextDigits[index - 1] = '';
      onChange(nextDigits.join(''));
      focusInput(index - 1);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusInput(index - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusInput(index + 1);
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const { insertedCount, isCompleted } = updateDigits(index, event.clipboardData.getData('text'));
    focusInput(index + insertedCount);

    if (isCompleted) {
      onComplete?.();
    }
  }

  return (
    <Stack direction="row" gap={1} role="group" aria-label={label} className="security-pin-input">
      {digits.map((digit, index) => (
        <div key={index}>
          <input
            ref={(element) => {
              inputReferences.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            style={{ WebkitTextSecurity: 'disc' } as CSSProperties}
            pattern="[0-9]*"
            maxLength={SECURITY_PIN_LENGTH}
            value={digit}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-label={`${label} ${index + 1}번째 숫자`}
            aria-invalid={error ? true : undefined}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => handleChange(index, event.currentTarget.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
          />
        </div>
      ))}
    </Stack>
  );
}
