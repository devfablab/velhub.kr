'use client';

import { useEffect, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Chip, Grid, Snackbar, Stack, Typography } from '@mui/material';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getSupabaseBrowser } from '@/lib/supabase';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/settings.module.sass';

export default function PasswordSetup() {
  const supabase = getSupabaseBrowser();

  const [isLoading, setIsLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

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

  function handleAccordionChange(_event: React.SyntheticEvent, expanded: boolean) {
    setIsExpanded(expanded);
  }

  async function handleSendPasswordSetupEmail() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const userResult = await supabase.auth.getUser();

      if (userResult.error) {
        throw new Error(userResult.error.message);
      }

      const authUser = userResult.data.user;

      if (!authUser?.email) {
        throw new Error('이메일 정보를 확인하지 못했습니다.');
      }

      const resetPasswordResult = await supabase.auth.resetPasswordForEmail(authUser.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetPasswordResult.error) {
        throw new Error(resetPasswordResult.error.message);
      }

      setSuccessMessage('비밀번호 설정 메일을 보냈습니다. 메일함을 확인해주세요.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '비밀번호 설정 메일 전송 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('비밀번호 설정 메일 전송 중 오류가 발생했습니다.');
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

  if (hasPassword) {
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
              비밀번호 설정
            </Typography>

            <Chip label="미설정" size="small" className="chip warning" />
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack gap={2.5}>
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>비밀번호를 설정하시면 이메일 방식으로도 로그인 가능합니다.</span>
            </p>

            <p className="alert warning">
              <WarningAmberRoundedIcon />
              <span>설정 이후에는 이메일 로그인 기능을 끌 수 없습니다.</span>
            </p>

            <button
              type="button"
              className="button medium submit"
              onClick={handleSendPasswordSetupEmail}
              disabled={isSubmitting}
            >
              비밀번호 설정 메일 보내기
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
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
