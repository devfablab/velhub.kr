'use client';

import { type JSX, useEffect, useState } from 'react';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { runInputAdornmentAction } from '@/lib/runInputAdornmentAction';
import styles from '@/app/new.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type Challenge = {
  image: string;
  challengeToken: string;
  failureCount: number;
};

type CaptchaResponse =
  | { status: 'passed'; passToken: string }
  | { status: 'failed'; remainingCount: number; challenge: Challenge }
  | { status: 'expired' | 'refreshed'; challenge: Challenge }
  | { status: 'blocked' };

type Props = {
  onPassTokenChange: (passToken: string) => void;
  onBlockedChange: (isBlocked: boolean) => void;
};

export default function SiteCaptcha({ onPassTokenChange, onBlockedChange }: Props) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isPassed, setIsPassed] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    fetch('/api/site/captcha', { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<Challenge>) : null))
      .then((result) => {
        if (!isActive) return;

        if (result) {
          setChallenge(result);
        } else {
          setErrorMessage('보안 문자를 불러오지 못했습니다. 새로고침해 주세요.');
        }
      })
      .catch(() => {
        if (isActive) setErrorMessage('보안 문자를 불러오지 못했습니다. 새로고침해 주세요.');
      });

    return () => {
      isActive = false;
    };
  }, []);

  function block() {
    setIsBlocked(true);
    setChallenge(null);
    setErrorMessage('');
    onBlockedChange(true);
  }

  async function request(body: Record<string, unknown>) {
    const response = await fetch('/api/site/captcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as (CaptchaResponse & { error?: string }) | null;

    if (!response.ok || !result) {
      throw new Error(result?.error ?? '보안 문자를 확인하지 못했습니다.');
    }

    return result;
  }

  async function handleRefresh() {
    if (!challenge || isChecking) return;

    setIsChecking(true);

    try {
      const result = await request({ action: 'refresh', challengeToken: challenge.challengeToken });

      if (result.status === 'blocked') {
        block();
      } else if (result.status === 'refreshed') {
        setChallenge(result.challenge);
        setAnswer('');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '보안 문자를 불러오지 못했습니다.');
    } finally {
      setIsChecking(false);
    }
  }

  async function handleCheck() {
    if (!challenge || isChecking || !answer.trim()) return;

    setIsChecking(true);
    setErrorMessage('');

    try {
      const result = await request({ challengeToken: challenge.challengeToken, answer });

      if (result.status === 'passed') {
        setIsPassed(true);
        setChallenge(null);
        onPassTokenChange(result.passToken);
        return;
      }

      if (result.status === 'blocked') {
        block();
        return;
      }

      setChallenge(result.challenge);
      setAnswer('');
      setErrorMessage(
        result.status === 'failed'
          ? `보안 문자가 일치하지 않습니다. 남은 기회는 ${result.remainingCount}번입니다.`
          : '보안 문자 입력 시간이 지났습니다. 새 문자를 입력해 주세요.',
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '보안 문자를 확인하지 못했습니다.');
    } finally {
      setIsChecking(false);
    }
  }

  function handleAnswerChange(event: InputChangeEvent) {
    setAnswer(event.target.value);
  }

  return (
    <Stack gap={1}>
      <Typography variant="subtitle2">보안 문자</Typography>

      {isPassed ? (
        <p className="alert info">
          <CheckCircleOutlineRoundedIcon />
          <span>보안 문자가 확인되었습니다.</span>
        </p>
      ) : null}

      {isBlocked ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>개설하실 수 없습니다.</span>
        </p>
      ) : null}

      {challenge ? (
        <>
          <Stack direction="row" gap={1} alignItems="center">
            <div className={styles['captcha-image']} dangerouslySetInnerHTML={{ __html: challenge.image }} />
            <button type="button" className="button small action" disabled={isChecking} onClick={handleRefresh}>
              새 문자
            </button>
          </Stack>
          <TextField
            size="small"
            value={answer}
            onChange={handleAnswerChange}
            onKeyDown={(event) => runInputAdornmentAction(event, handleCheck, isChecking || !answer.trim())}
            placeholder="그림에 보이는 문자를 입력해 주세요"
            fullWidth
            disabled={isChecking}
            slotProps={{
              htmlInput: { maxLength: 10, autoComplete: 'off' },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <button
                      type="button"
                      className="button small action"
                      disabled={isChecking || !answer.trim()}
                      onClick={handleCheck}
                    >
                      확인
                    </button>
                  </InputAdornment>
                ),
              },
            }}
          />
        </>
      ) : null}

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}
    </Stack>
  );
}
