'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Dialog, DialogActions, DialogContent, DialogTitle, Drawer, useMediaQuery, useTheme } from '@mui/material';
import Anchor from '@/components/Anchor';

type Props = {
  open: boolean;
  title?: string | null;
  messages: string[];
  onClose: () => void;
};

export default function FormErrorDialog({ open, title, messages, onClose }: Props) {
  const loginHref = messages.includes('로그인이 필요합니다.') ? '/auth/sign-in' : '';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const messageContent = title ? (
    <ul className="error-messages">
      {messages.map((message, index) => (
        <li key={`${index}-${message}`}>{message}</li>
      ))}
    </ul>
  ) : (
    <p className="alert popup-error">
      <ErrorOutlineRoundedIcon />
      <span>{messages[0] ?? '요청을 처리하지 못했습니다.'}</span>
    </p>
  );

  return isMobile ? (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      className="VhiDrawer-bottom VhiDrawer-bottom-service"
      slotProps={{ paper: { 'aria-labelledby': title ? 'form-error-drawer-title' : undefined } }}
    >
      {title ? <h2 id="form-error-drawer-title">{title}</h2> : null}
      <div className="VhiDrawer-bottom-content">{messageContent}</div>
      <div className="drawer-dialog-actions">
        <button type="button" className={loginHref ? 'cancel-button' : undefined} onClick={onClose}>
          확인
        </button>
        {loginHref ? (
          <Anchor href={loginHref} onClick={onClose}>
            로그인
          </Anchor>
        ) : null}
      </div>
    </Drawer>
  ) : (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog">
      {title ? <DialogTitle>{title}</DialogTitle> : null}
      <DialogContent>{messageContent}</DialogContent>
      <DialogActions>
        <button type="button" className={loginHref ? 'cancel-button' : undefined} onClick={onClose}>
          확인
        </button>
        {loginHref ? (
          <Anchor href={loginHref} onClick={onClose}>
            로그인
          </Anchor>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
