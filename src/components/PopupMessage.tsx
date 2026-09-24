'use client';

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

  return isMobile ? (
    <Drawer anchor="bottom" open={open} onClose={onClose} className="VhiDrawer-bottom">
      <Stack gap={2} sx={{ pt: 1 }}>
        <p className={`popup-message ${kind}`}>{message}</p>
        <Stack direction="column" gap={1.5}>
          <button type="button" className="button medium submit" onClick={onClose}>
            확인
          </button>
        </Stack>
      </Stack>
    </Drawer>
  ) : (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog">
      <DialogContent>
        <p className={`popup-message ${kind}`}>{message}</p>
      </DialogContent>
      <DialogActions>
        <button type="button" className="button medium submit" onClick={onClose}>
          확인
        </button>
      </DialogActions>
    </Dialog>
  );
}
