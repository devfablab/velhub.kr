'use client';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

type PlanBillingMemberPopupProps = {
  open: boolean;
  onClose: () => void;
};

export default function PlanBillingMemberPopup({ open, onClose }: PlanBillingMemberPopupProps) {
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('lg'));

  if (isMobile) {
    return (
      <Drawer anchor="bottom" open={open} onClose={onClose} className="VhiDrawer-bottom">
        <h2>요금제 결제 멤버</h2>
        <button type="button" className="close-button" onClick={onClose} aria-label="요금제 결제 멤버 팝업 닫기">
          <CloseRoundedIcon />
        </button>
        <Stack gap={3}>
          <Typography variant="subtitle2">해당 멤버는 요금제를 월결제해주시는 분입니다.</Typography>
          <button type="button" className="button medium submit" onClick={onClose}>
            확인
          </button>
        </Stack>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" className="VhiDialog">
      <DialogTitle>요금제 결제 멤버</DialogTitle>
      <button type="button" className="close-button" onClick={onClose} aria-label="요금제 결제 멤버 팝업 닫기">
        <CloseRoundedIcon />
      </button>
      <DialogContent>
        <Typography variant="subtitle2">해당 멤버는 요금제를 월결제해주시는 분입니다.</Typography>
      </DialogContent>
      <DialogActions>
        <button type="button" className="button medium submit" onClick={onClose}>
          확인
        </button>
      </DialogActions>
    </Dialog>
  );
}
