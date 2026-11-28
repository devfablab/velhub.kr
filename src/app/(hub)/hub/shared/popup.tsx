'use client';

import type { ReactNode } from 'react';
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
  dialogClassName?: string;
  drawerClassName?: string;
  variant?: 'default' | 'content';
  formId?: string;
  onSubmit?: () => void;
};

function getDialogActionClass(intent: ResponsivePopupAction['intent'], isSingleAction: boolean) {
  if (intent === 'danger' || intent === 'warning') return 'danger-button';
  if (isSingleAction) return undefined;
  if (intent === 'cancel') return 'cancel-button';
  if (intent === 'action') return 'action-button';
  return undefined;
}

function getContentActionClass(intent: ResponsivePopupAction['intent'], isSingleAction: boolean, isMobile = false) {
  if (intent === 'danger' || intent === 'warning') return 'button medium danger';
  if (isSingleAction) return 'button medium submit';
  if (intent === 'cancel') return isMobile ? 'button medium cancel' : 'button medium close';
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
  dialogClassName = '',
  drawerClassName = '',
  variant = 'default',
  formId,
  onSubmit,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  return isMobile ? (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      className={`VhiDrawer-bottom ${variant === 'content' ? '' : 'VhiDrawer-bottom-service'} ${drawerClassName}`.trim()}
      slotProps={{ paper: { 'aria-labelledby': 'hub-shared-popup-drawer-title' } }}
    >
      <h2 id="hub-shared-popup-drawer-title">{title}</h2>
      <Tooltip title="닫기">
        <button type="button" className="close-button" onClick={onClose}>
          <CloseRoundedIcon />
        </button>
      </Tooltip>
      <div className="VhiDrawer-bottom-content">
        {formId ? (
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit?.();
            }}
          >
            {children}
          </form>
        ) : (
          children
        )}
      </div>
      <div className="drawer-dialog-actions">
        {actions.map((action, index) => (
          <button
            key={index}
            type={formId && action.intent === 'submit' ? 'submit' : 'button'}
            form={formId && action.intent === 'submit' ? formId : undefined}
            className={
              variant === 'content'
                ? getContentActionClass(action.intent, actions.length === 1, true)
                : getDialogActionClass(action.intent, actions.length === 1)
            }
            onClick={formId && action.intent === 'submit' ? undefined : action.onClick}
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
      className={`${variant === 'content' ? 'VhiDialog' : 'vh-dialog vh-alert-dialog'} ${dialogClassName}`.trim()}
    >
      <DialogTitle>{title}</DialogTitle>
      <Tooltip title="닫기">
        <button type="button" className="close-button" onClick={onClose}>
          <CloseRoundedIcon />
        </button>
      </Tooltip>
      <DialogContent>
        {formId ? (
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit?.();
            }}
          >
            {children}
          </form>
        ) : (
          children
        )}
      </DialogContent>
      <DialogActions>
        {actions.map((action, index) => (
          <button
            key={index}
            type={formId && action.intent === 'submit' ? 'submit' : 'button'}
            form={formId && action.intent === 'submit' ? formId : undefined}
            className={
              variant === 'content'
                ? getContentActionClass(action.intent, actions.length === 1)
                : getDialogActionClass(action.intent, actions.length === 1)
            }
            onClick={formId && action.intent === 'submit' ? undefined : action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </DialogActions>
    </Dialog>
  );
}
