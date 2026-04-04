'use client';

import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getSupabaseBrowser } from '@/lib/supabase';

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
    return null;
  }

  if (hasPassword) {
    return null;
  }

  return (
    <Accordion expanded={isExpanded} onChange={handleAccordionChange} disableGutters elevation={0}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box
          sx={{
            width: '100%',
            pr: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="h6" component="h2">
            비밀번호 설정
          </Typography>

          <Chip label="미설정" size="small" color="warning" />
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        <Stack spacing={2.5}>
          <Typography variant="body2">비밀번호를 설정하시면 이메일 방식으로도 로그인 가능합니다.</Typography>

          <Typography variant="body2">주의: 설정 이후에는 이메일 로그인 기능을 끌 수 없습니다.</Typography>

          <Button
            type="button"
            variant="contained"
            onClick={handleSendPasswordSetupEmail}
            disabled={isSubmitting}
            fullWidth
          >
            비밀번호 설정 메일 보내기
          </Button>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
