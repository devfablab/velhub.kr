'use client';

import { useEffect, useState, type JSX } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type DefaultLoginMethod = 'email' | 'social';

export default function LoginMethod() {
  const [email, setEmail] = useState('');
  const [selectedLoginMethod, setSelectedLoginMethod] = useState<DefaultLoginMethod>('email');
  const [savedLoginMethod, setSavedLoginMethod] = useState<DefaultLoginMethod>('email');
  const [canChangeDefaultLoginMethod, setCanChangeDefaultLoginMethod] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadLoginMethod() {
      try {
        const response = await fetch('/api/auth/default-login-method', {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '기본 로그인 방식을 확인하지 못했습니다.');
        }

        setEmail(result.email ?? '');
        setSelectedLoginMethod(result.defaultLoginMethod);
        setSavedLoginMethod(result.defaultLoginMethod);
        setCanChangeDefaultLoginMethod(Boolean(result.canChangeDefaultLoginMethod));
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '기본 로그인 방식을 확인하지 못했습니다.');
        } else {
          setErrorMessage('기본 로그인 방식을 확인하지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadLoginMethod();
  }, []);

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
    return null;
  }

  if (!canChangeDefaultLoginMethod) {
    return null;
  }

  return (
    <Grid size={12}>
      <Accordion expanded={isExpanded} onChange={handleAccordionChange} disableGutters elevation={3}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack
            alignContent="center"
            justifyContent="space-between"
            gap={2}
            direction="row"
            sx={{ width: '100%', pr: 1 }}
          >
            <Typography variant="subtitle2" component="span">
              기본 로그인 방식
            </Typography>

            <Chip label={savedLoginMethod === 'email' ? '이메일 우선' : '소셜 우선'} size="small" color="primary" />
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack spacing={2.5}>
            {email ? <Typography variant="body2">계정 이메일: {email}</Typography> : null}

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

            <Button
              type="button"
              variant="contained"
              onClick={handleSave}
              disabled={isSubmitting || selectedLoginMethod === savedLoginMethod}
              fullWidth
            >
              기본 로그인 방식 변경
            </Button>

            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
