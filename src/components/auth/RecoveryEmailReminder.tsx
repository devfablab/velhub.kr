'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { RECOVERY_EMAIL_LABEL } from '@/lib/auth/recoveryEmail';

const REMINDED_STORAGE_KEY = 'recovery-email:reminded';
const TITLE = `${RECOVERY_EMAIL_LABEL} 등록`;
const MESSAGE = `${RECOVERY_EMAIL_LABEL}을 등록해 주세요.\n본인 확인 인증번호와 임시 보안 비밀번호를 이 이메일로 보냅니다.`;

function hasReminded() {
  try {
    return sessionStorage.getItem(REMINDED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markReminded() {
  try {
    sessionStorage.setItem(REMINDED_STORAGE_KEY, '1');
  } catch {
    return;
  }
}

export default function RecoveryEmailReminder() {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith('/settings') || pathname.startsWith('/auth') || hasReminded()) return;

    let isCancelled = false;

    async function loadState() {
      try {
        const response = await fetch('/api/auth/recovery-email', { credentials: 'include', cache: 'no-store' });
        const result = (await response.json().catch(() => null)) as {
          needsRecoveryEmail?: boolean;
          hasRecoveryEmail?: boolean;
        } | null;

        if (isCancelled || !response.ok) return;

        markReminded();

        if (result?.needsRecoveryEmail && !result.hasRecoveryEmail) {
          setIsOpen(true);
        }
      } catch {
        return;
      }
    }

    void loadState();

    return () => {
      isCancelled = true;
    };
  }, [pathname]);

  function handleClose() {
    setIsOpen(false);
  }

  function handleMove() {
    setIsOpen(false);
    router.push('/settings?recoveryEmail=required');
  }

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={isOpen}
        onClose={handleClose}
        className="VhiDrawer-bottom VhiDrawer-bottom-service"
        slotProps={{ paper: { 'aria-labelledby': 'recovery-email-reminder-title' } }}
      >
        <h2 id="recovery-email-reminder-title">{TITLE}</h2>
        <Tooltip title="닫기">
          <button type="button" className="close-button" onClick={handleClose}>
            <CloseRoundedIcon />
          </button>
        </Tooltip>
        <div className="VhiDrawer-bottom-content">
          <Typography variant="body2" component="p" sx={{ whiteSpace: 'pre-line' }}>
            {MESSAGE}
          </Typography>
        </div>
        <div className="drawer-dialog-actions">
          <button type="button" className="button medium close" onClick={handleClose}>
            나중에
          </button>
          <button type="button" className="button medium submit" onClick={handleMove}>
            등록하러 가기
          </button>
        </div>
      </Drawer>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      className="vh-dialog vh-alert-dialog"
      aria-labelledby="recovery-email-reminder-title"
    >
      <DialogTitle id="recovery-email-reminder-title">{TITLE}</DialogTitle>
      <Tooltip title="닫기">
        <button type="button" className="close-button" onClick={handleClose}>
          <CloseRoundedIcon />
        </button>
      </Tooltip>
      <DialogContent>
        <Typography variant="body2" component="p" sx={{ whiteSpace: 'pre-line' }}>
          {MESSAGE}
        </Typography>
      </DialogContent>
      <DialogActions>
        <button type="button" className="cancel-button" onClick={handleClose}>
          나중에
        </button>
        <button type="button" onClick={handleMove}>
          등록하러 가기
        </button>
      </DialogActions>
    </Dialog>
  );
}
