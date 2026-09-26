'use client';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import { Dialog, DialogActions, DialogContent, Drawer, Stack, useMediaQuery, useTheme } from '@mui/material';

type Props = {
  open: boolean;
  message: string;
  onClose: () => void;
  kind?: 'info' | 'error';
};

export default function PopupMessage({ open, message, onClose, kind = 'info' }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const messageContent = (
    <p className={`alert popup-${kind}`}>
      {kind === 'error' ? <ErrorOutlineRoundedIcon /> : <InfoOutlineRoundedIcon />}
      <span>{message}</span>
    </p>
  );

  return isMobile ? (
    <Drawer anchor="bottom" open={open} onClose={onClose} className="VhiDrawer-bottom">
      <Stack gap={2} sx={{ pt: 1 }}>
        {messageContent}
        <Stack direction="column" gap={1.5}>
          <button type="button" className="button medium submit" onClick={onClose}>
            확인
          </button>
        </Stack>
      </Stack>
    </Drawer>
  ) : (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog">
      <DialogContent>{messageContent}</DialogContent>
      <DialogActions>
        <button type="button" className="button medium submit" onClick={onClose}>
          확인
        </button>
      </DialogActions>
    </Dialog>
  );
}
