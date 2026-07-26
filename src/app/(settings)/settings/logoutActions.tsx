'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Grid,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getSupabaseBrowser } from '@/lib/supabase';
import styles from '@/app/settings.module.sass';

export default function LogoutActions() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggingOutCurrentDevice, setIsLoggingOutCurrentDevice] = useState(false);
  const [isLoggingOutAllDevices, setIsLoggingOutAllDevices] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

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
              로그아웃
            </Typography>
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack gap={1} direction="row" justifyContent="space-between">
            <button
              type="button"
              className="button small action"
              onClick={handleLogoutCurrentDevice}
              disabled={isLoggingOutCurrentDevice || isLoggingOutAllDevices}
            >
              이 디바이스에서 로그아웃
            </button>

            <button
              type="button"
              className="button small danger"
              onClick={handleOpenConfirm}
              disabled={isLoggingOutCurrentDevice || isLoggingOutAllDevices}
            >
              모든 디바이스 로그아웃
            </button>

            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {isMobile ? (
        <Drawer anchor="bottom" open={isConfirmOpen} onClose={handleCloseConfirm} className="VhiDrawer-bottom">
          <h2>모든 디바이스 로그아웃</h2>
          <button className="close-button" onClick={handleCloseConfirm}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            <Typography variant="subtitle2">모든 디바이스에서 로그아웃하시겠어요?</Typography>
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button small cancel"
                onClick={handleCloseConfirm}
                disabled={isLoggingOutAllDevices}
              >
                취소
              </button>
              <button
                type="button"
                className="button small danger"
                onClick={handleLogoutAllDevices}
                disabled={isLoggingOutAllDevices}
              >
                로그아웃
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={isConfirmOpen} onClose={handleCloseConfirm} fullWidth maxWidth="xs" className="VhiDialog">
          <DialogTitle>모든 디바이스 로그아웃</DialogTitle>
          <button className="close-button" onClick={handleCloseConfirm}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography variant="subtitle2">모든 디바이스에서 로그아웃하시겠어요?</Typography>
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button small close"
              onClick={handleCloseConfirm}
              disabled={isLoggingOutAllDevices}
            >
              취소
            </button>
            <button
              type="button"
              className="button small danger"
              onClick={handleLogoutAllDevices}
              disabled={isLoggingOutAllDevices}
            >
              로그아웃
            </button>
          </DialogActions>
        </Dialog>
      )}
    </Grid>
  );
}
