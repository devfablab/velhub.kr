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
  variant?: 'default' | 'content';
};

function getDialogActionClass(intent: ResponsivePopupAction['intent'], isSingleAction: boolean) {
  if (intent === 'danger' || intent === 'warning') return 'danger-button';
  if (isSingleAction) return undefined;
  if (intent === 'cancel') return 'cancel-button';
  if (intent === 'action') return 'action-button';
  return undefined;
}

function getContentActionClass(intent: ResponsivePopupAction['intent'], isSingleAction: boolean) {
  if (intent === 'danger' || intent === 'warning') return 'button medium danger';
  if (isSingleAction) return 'button medium submit';
  if (intent === 'cancel') return 'button medium close';
  if (intent === 'action') return 'button medium action';
  return 'button medium submit';
}

export default function ResponsivePopup({
  open,
  title,
  children,
  actions,
  onClose,
  maxWidth = 'sm',
  variant = 'default',
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  return isMobile ? (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      className={variant === 'content' ? 'VhiDrawer-bottom' : 'VhiDrawer-bottom VhiDrawer-bottom-service'}
    >
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
            className={getContentActionClass(action.intent, actions.length === 1)}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </Drawer>
  ) : (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      className={variant === 'content' ? 'VhiDialog' : 'vh-dialog vh-alert-dialog'}
    >
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
            className={
              variant === 'content'
                ? getContentActionClass(action.intent, actions.length === 1)
                : getDialogActionClass(action.intent, actions.length === 1)
            }
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
