'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Dialog, DialogActions, DialogContent, DialogTitle, Drawer, useMediaQuery, useTheme } from '@mui/material';

type Props = {
  open: boolean;
  title?: string | null;
  messages: string[];
  onClose: () => void;
};

export default function FormErrorDialog({ open, title, messages, onClose }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const messageContent = title ? (
    <ul>
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  ) : (
    <p className="alert popup-error">
      <ErrorOutlineRoundedIcon />
      <span>{messages[0] ?? '요청을 처리하지 못했습니다.'}</span>
    </p>
  );

  return isMobile ? (
    <Drawer anchor="bottom" open={open} onClose={onClose} className="VhiDrawer-bottom VhiDrawer-bottom-service">
      {title ? <h2>{title}</h2> : null}
      <div className="VhiDrawer-bottom-content">{messageContent}</div>
      <div className="drawer-dialog-actions">
        <button type="button" className="button small submit" onClick={onClose}>
          확인
        </button>
      </div>
    </Drawer>
  ) : (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog">
      {title ? <DialogTitle>{title}</DialogTitle> : null}
      <DialogContent>{messageContent}</DialogContent>
      <DialogActions>
        <button type="button" onClick={onClose}>
          확인
        </button>
      </DialogActions>
    </Dialog>
  );
}
