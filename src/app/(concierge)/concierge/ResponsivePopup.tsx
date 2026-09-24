'use client';

import type { ReactNode } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Dialog, DialogActions, DialogContent, DialogTitle, Drawer, useMediaQuery, useTheme } from '@mui/material';
import type { DialogProps } from '@mui/material/Dialog';

export type ResponsivePopupAction = {
  label: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  intent?: 'cancel' | 'action' | 'submit' | 'danger' | 'warning';
};

type Props = {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  actions: ResponsivePopupAction[];
  onClose: () => void;
  maxWidth?: DialogProps['maxWidth'];
};

function getDialogActionClass(intent: ResponsivePopupAction['intent']) {
  if (intent === 'cancel') return 'cancel-button';
  if (intent === 'danger') return 'delete-button';
  if (intent === 'warning') return 'warning-button';
  return undefined;
}

export default function ResponsivePopup({ open, title, children, actions, onClose, maxWidth = 'sm' }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  return isMobile ? (
    <Drawer anchor="bottom" open={open} onClose={onClose} className="VhiDrawer-bottom VhiDrawer-bottom-service">
      <h2>{title}</h2>
      <button type="button" className="close-button" onClick={onClose} aria-label="닫기">
        <CloseRoundedIcon />
      </button>
      <div className="VhiDrawer-bottom-content">{children}</div>
      <div className="drawer-dialog-actions">
        {actions.map((action, index) => (
          <button
            key={index}
            type="button"
            className={`button small ${action.intent ?? 'action'}`}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </Drawer>
  ) : (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth className="vh-dialog vh-alert-dialog">
      <DialogTitle>{title}</DialogTitle>
      <button type="button" className="close-button" onClick={onClose} aria-label="닫기">
        <CloseRoundedIcon />
      </button>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        {actions.map((action, index) => (
          <button
            key={index}
            type="button"
            className={getDialogActionClass(action.intent)}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </DialogActions>
    </Dialog>
  );
}
