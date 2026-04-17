'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getSupabaseBrowser } from '@/lib/supabase';

export default function LogoutActions() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggingOutCurrentDevice, setIsLoggingOutCurrentDevice] = useState(false);
  const [isLoggingOutAllDevices, setIsLoggingOutAllDevices] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  function handleAccordionChange(_event: React.SyntheticEvent, expanded: boolean) {
    setIsExpanded(expanded);
  }

  async function handleLogoutCurrentDevice() {
    if (isLoggingOutCurrentDevice || isLoggingOutAllDevices) {
      return;
    }

    setErrorMessage('');
    setIsLoggingOutCurrentDevice(true);

    try {
      const signOutResult = await supabase.auth.signOut({
        scope: 'local',
      });

      if (signOutResult.error) {
        throw new Error(signOutResult.error.message);
      }

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '이 디바이스 로그아웃 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('이 디바이스 로그아웃 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoggingOutCurrentDevice(false);
    }
  }

  function handleOpenConfirm() {
    if (isLoggingOutCurrentDevice || isLoggingOutAllDevices) {
      return;
    }

    setIsConfirmOpen(true);
  }

  function handleCloseConfirm() {
    if (isLoggingOutAllDevices) {
      return;
    }

    setIsConfirmOpen(false);
  }

  async function handleLogoutAllDevices() {
    if (isLoggingOutCurrentDevice || isLoggingOutAllDevices) {
      return;
    }

    setErrorMessage('');
    setIsLoggingOutAllDevices(true);

    try {
      const signOutResult = await supabase.auth.signOut({
        scope: 'global',
      });

      if (signOutResult.error) {
        throw new Error(signOutResult.error.message);
      }

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '모든 디바이스 로그아웃 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('모든 디바이스 로그아웃 중 오류가 발생했습니다.');
      }
      setIsConfirmOpen(false);
    } finally {
      setIsLoggingOutAllDevices(false);
    }
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
              로그아웃
            </Typography>
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack spacing={1} direction="row">
            <Button
              type="button"
              variant="contained"
              color="warning"
              onClick={handleLogoutCurrentDevice}
              disabled={isLoggingOutCurrentDevice || isLoggingOutAllDevices}
              fullWidth
            >
              이 디바이스에서 로그아웃
            </Button>

            <Button
              type="button"
              variant="outlined"
              color="error"
              onClick={handleOpenConfirm}
              disabled={isLoggingOutCurrentDevice || isLoggingOutAllDevices}
              fullWidth
            >
              모든 디바이스 로그아웃
            </Button>

            {errorMessage ? (
              <Alert severity="error" variant="filled">
                {errorMessage}
              </Alert>
            ) : null}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Dialog open={isConfirmOpen} onClose={handleCloseConfirm} fullWidth maxWidth="xs">
        <DialogTitle>모든 디바이스 로그아웃</DialogTitle>
        <DialogContent>
          <Typography>모든 디바이스에서 로그아웃하시겠어요?</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={handleCloseConfirm} disabled={isLoggingOutAllDevices}>
            취소
          </Button>
          <Button
            type="button"
            variant="contained"
            color="error"
            onClick={handleLogoutAllDevices}
            disabled={isLoggingOutAllDevices}
          >
            로그아웃
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
