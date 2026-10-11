import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { ServiceErrorIcon, ServiceNoDataIcon, ServiceWarningIcon } from '@/components/Svgs';

type ScreenStateKind = 'empty' | 'error' | 'warning';

type Props = {
  children: ReactNode;
  kind?: ScreenStateKind;
  action?: ReactNode;
};

export default function ScreenState({ children, kind = 'empty', action }: Props) {
  const className = kind === 'error' ? 'page-error' : kind === 'warning' ? 'page-warning' : 'page-info';

  return (
    <div className={`paper ${className}`}>
      {kind === 'error' ? <ServiceErrorIcon /> : kind === 'warning' ? <ServiceWarningIcon /> : <ServiceNoDataIcon />}
      <p>{children}</p>
      {action ? <Box sx={{ mt: 0.5 }}>{action}</Box> : null}
    </div>
  );
}
