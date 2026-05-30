'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Grid,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getSupabaseBrowser } from '@/lib/supabase';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/settings.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

export default function PasswordChange() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [isLoading, setIsLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadPasswordStatus() {
      try {
        const response = await fetch('/api/auth/password/status', {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '비밀번호 상태를 확인하지 못했습니다.');
        }

        setHasPassword(Boolean(result.hasPassword));
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '비밀번호 상태를 확인하지 못했습니다.');
        } else {
          setErrorMessage('비밀번호 상태를 확인하지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPasswordStatus();
  }, []);

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
      const sessionResult = await supabase.auth.getSession();

      if (sessionResult.error) {
        throw new Error(sessionResult.error.message);
      }

      const authSession = sessionResult.data.session;

      if (!authSession?.user?.email) {
        throw new Error('로그인 정보를 확인하지 못했습니다.');
      }

      const signInResult = await supabase.auth.signInWithPassword({
        email: authSession.user.email,
        password: currentPassword,
      });

      if (signInResult.error) {
        throw new Error('현재 비밀번호가 올바르지 않습니다.');
      }

      const updateUserResult = await supabase.auth.updateUser({
        password: nextPassword,
      });

      if (updateUserResult.error) {
        throw new Error(updateUserResult.error.message);
      }

      const signOutResult = await supabase.auth.signOut({
        scope: 'local',
      });

      if (signOutResult.error) {
        throw new Error(signOutResult.error.message);
      }

      setCurrentPassword('');
      setNextPassword('');
      setNextPasswordConfirm('');
      setSuccessMessage('비밀번호가 변경되어 로그아웃되었습니다.');

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '비밀번호 변경 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('비밀번호 변경 중 오류가 발생했습니다.');
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

              {errorMessage ? <p className="alert error">{errorMessage}</p> : null}
              <Snackbar
                open={Boolean(successMessage)}
                message={successMessage}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'center',
                }}
                autoHideDuration={2700}
                onClose={() => setSuccessMessage('')}
              />
            </Stack>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
