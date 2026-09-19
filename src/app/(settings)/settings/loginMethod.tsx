'use client';

import { type JSX, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PopupMessage from '@/components/PopupMessage';
import styles from '@/app/settings.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type DefaultLoginMethod = 'email' | 'social';

export default function LoginMethod({
  initialData,
  initialError,
}: {
  initialData: {
    email?: string;
    defaultLoginMethod?: DefaultLoginMethod;
    canChangeDefaultLoginMethod?: boolean;
  } | null;
  initialError: string;
}) {
  const email = initialData?.email ?? '';
  const [selectedLoginMethod, setSelectedLoginMethod] = useState<DefaultLoginMethod>(
    initialData?.defaultLoginMethod ?? 'email',
  );
  const [savedLoginMethod, setSavedLoginMethod] = useState<DefaultLoginMethod>(
    initialData?.defaultLoginMethod ?? 'email',
  );
  const canChangeDefaultLoginMethod = Boolean(initialData?.canChangeDefaultLoginMethod);
  const [isLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [successMessage, setSuccessMessage] = useState('');

  function handleAccordionChange(_event: React.SyntheticEvent, expanded: boolean) {
    setIsExpanded(expanded);
  }

  function handleLoginMethodChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value as DefaultLoginMethod;

    if (nextValue !== 'email' && nextValue !== 'social') {
      return;
    }

    setSelectedLoginMethod(nextValue);
    setSuccessMessage('');
  }

  async function handleSave() {
    if (isSubmitting || !canChangeDefaultLoginMethod) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/default-login-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          defaultLoginMethod: selectedLoginMethod,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '기본 로그인 방식 변경에 실패했습니다.');
      }

      setSavedLoginMethod(result.defaultLoginMethod);
      setSuccessMessage('기본 로그인 방식이 변경되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '기본 로그인 방식 변경에 실패했습니다.');
      } else {
        setErrorMessage('기본 로그인 방식 변경에 실패했습니다.');
      }
    } finally {
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

  if (!canChangeDefaultLoginMethod) {
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
              기본 로그인 방식
            </Typography>

            <Chip
              label={savedLoginMethod === 'email' ? '이메일 우선' : '소셜 우선'}
              size="small"
              className="chip successs"
            />
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack gap={2.5}>
            {email ? <Typography variant="body2">이메일 {email}</Typography> : null}

            <RadioGroup name="defaultLoginMethod" value={selectedLoginMethod}>
              <FormControlLabel
                value="email"
                control={<Radio onChange={handleLoginMethodChange} />}
                label="이메일 로그인 우선"
              />

              <FormControlLabel
                value="social"
                control={<Radio onChange={handleLoginMethodChange} />}
                label="소셜 로그인 우선"
              />
            </RadioGroup>

            <button
              type="button"
              className="button medium submit"
              onClick={handleSave}
              disabled={isSubmitting || selectedLoginMethod === savedLoginMethod}
            >
              기본 로그인 방식 변경
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
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
