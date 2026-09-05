import type { ReactNode } from 'react';
import { ServiceErrorIcon, ServiceNoDataIcon, ServiceWarningIcon } from '@/components/Svgs';

type ScreenStateKind = 'empty' | 'error' | 'warning';

type Props = {
  children: ReactNode;
  kind?: ScreenStateKind;
};

export default function ScreenState({ children, kind = 'empty' }: Props) {
  const className = kind === 'error' ? 'page-error' : kind === 'warning' ? 'page-warning' : 'page-info';

  return (
    <div className={`paper ${className}`}>
      {kind === 'error' ? <ServiceErrorIcon /> : kind === 'warning' ? <ServiceWarningIcon /> : <ServiceNoDataIcon />}
      <p>{children}</p>
    </div>
  );
}
