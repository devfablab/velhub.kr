import { CircularProgress } from '@mui/material';

export function LoadingIndicator() {
  return (
    <>
      <svg width={0} height={0}>
        <defs>
          <linearGradient id="loading_gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e01cd5" />
            <stop offset="100%" stopColor="#1CB5E0" />
          </linearGradient>
        </defs>
      </svg>
      <CircularProgress aria-label="Loading…" sx={{ 'svg circle': { stroke: 'url(#loading_gradient)' } }} />
    </>
  );
}
