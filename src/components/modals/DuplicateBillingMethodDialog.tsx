'use client';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  useMediaQuery,
  useTheme,
  Tooltip,
} from '@mui/material';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DuplicateBillingMethodDialog({ open, title, onClose, onConfirm }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        className="VhiDrawer-bottom VhiDrawer-bottom-service"
        slotProps={{ paper: { 'aria-labelledby': 'components-modals-duplicate-billing-method-dialog-drawer-title' } }}
      >
        <h2 id="components-modals-duplicate-billing-method-dialog-drawer-title">{title}</h2>
        <Tooltip title="닫기">
          <button type="button" className="close-button" onClick={onClose}>
            <CloseRoundedIcon />
          </button>
        </Tooltip>
        <div className="VhiDrawer-bottom-content">
          <p>이전 결제 수단과 동일한 결제 수단입니다.</p>
        </div>
        <div className="drawer-dialog-actions">
          <button type="button" onClick={onConfirm}>
            확인
          </button>
        </div>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog">
      <DialogTitle>{title}</DialogTitle>
      <Tooltip title="닫기">
        <button type="button" className="close-button" onClick={onClose}>
          <CloseRoundedIcon />
        </button>
      </Tooltip>
      <DialogContent>이전 결제 수단과 동일한 결제 수단입니다.</DialogContent>
      <DialogActions>
        <button type="button" onClick={onConfirm}>
          확인
        </button>
      </DialogActions>
    </Dialog>
  );
}
