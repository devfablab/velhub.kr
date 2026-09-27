'use client';

import { type JSX, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, Grid, Stack, TextField, Typography } from '@mui/material';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PopupMessage from '@/components/PopupMessage';
import styles from '@/app/settings.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

export default function PasswordChange({
  initialHasPassword,
  initialError,
}: {
  initialHasPassword: boolean;
  initialError: string;
}) {
  const router = useRouter();
  const [isLoading] = useState(false);
  const [hasPassword] = useState(initialHasPassword);
  const [isExpanded, setIsExpanded] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleCurrentPasswordChange(event: InputChangeEvent) {
    setCurrentPassword(event.currentTarget.value);
  }

  function handleNextPasswordChange(event: InputChangeEvent) {
    setNextPassword(event.currentTarget.value);
  }

  function handleNextPasswordConfirmChange(event: InputChangeEvent) {
    setNextPasswordConfirm(event.currentTarget.value);
  }

  function handleAccordionChange(_event: React.SyntheticEvent, expanded: boolean) {
    setIsExpanded(expanded);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!currentPassword) {
      setErrorMessage('현재 비밀번호를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!nextPassword) {
      setErrorMessage('새 비밀번호를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!nextPasswordConfirm) {
      setErrorMessage('새 비밀번호 확인을 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (nextPassword !== nextPasswordConfirm) {
      setErrorMessage('새 비밀번호가 일치하지 않습니다.');
      setSuccessMessage('');
      return;
    }

    if (currentPassword === nextPassword) {
      setErrorMessage('현재 비밀번호와 다른 비밀번호를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, nextPassword, nextPasswordConfirm }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; errors?: string[] } | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.errors?.[0] ?? '비밀번호 변경 중 오류가 발생했습니다.');
      }

      setCurrentPassword('');
      setNextPassword('');
      setNextPasswordConfirm('');
      setSuccessMessage('비밀번호가 변경되어 모든 디바이스에서 로그아웃되었습니다.');

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '비밀번호 변경 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('비밀번호 변경 중 오류가 발생했습니다.');
      }
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Grid size={12}>
        <Stack justifyContent="center" alignItems="center">
          <LoadingIndicator />
        </Stack>
      </Grid>
    );
  }

  if (!hasPassword) {
    return null;
  }

  return (
    <Grid size={12} className={styles.grid}>
      <Accordion
        expanded={isExpanded}
        onChange={handleAccordionChange}
        disableGutters
        variant="outlined"
        className={`paper ${styles.paper}`}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack
            alignContent="center"
            justifyContent="space-between"
            gap={2}
            direction="row"
            sx={{ width: '100%', pr: 1 }}
          >
            <Typography variant="subtitle2" component="strong">
              비밀번호 변경
            </Typography>
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack gap={2.5}>
              <Stack gap={1}>
                <Typography variant="subtitle2">현재 비밀번호</Typography>
                <TextField
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={handleCurrentPasswordChange}
                  size="small"
                  fullWidth
                />
              </Stack>

              <Stack gap={1}>
                <Typography variant="subtitle2">새 비밀번호</Typography>
                <TextField
                  id="nextPassword"
                  type="password"
                  autoComplete="new-password"
                  value={nextPassword}
                  onChange={handleNextPasswordChange}
                  size="small"
                  fullWidth
                />
              </Stack>

              <Stack gap={1}>
                <Typography variant="subtitle2">새 비밀번호 확인</Typography>
                <TextField
                  id="nextPasswordConfirm"
                  type="password"
                  autoComplete="new-password"
                  value={nextPasswordConfirm}
                  onChange={handleNextPasswordConfirmChange}
                  size="small"
                  fullWidth
                />
              </Stack>

              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>비밀번호 변경시 자동으로 로그아웃됩니다.</span>
              </p>

              <button type="submit" className="button medium submit" disabled={isSubmitting}>
                비밀번호 변경
              </button>

              {errorMessage ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>{errorMessage}</span>
                </p>
              ) : null}
              <PopupMessage
                open={Boolean(successMessage)}
                message={successMessage}
                onClose={() => setSuccessMessage('')}
              />
            </Stack>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
