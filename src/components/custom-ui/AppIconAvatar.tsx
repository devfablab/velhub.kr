'use client';

import { useId } from 'react';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import InterestsRoundedIcon from '@mui/icons-material/InterestsRounded';

type AppIconAvatarProps = {
  size: number;
  src?: string | null;
  alt?: string;
  site?: string;
};

const ORIGINAL_SIZE = 167;

const PATH_D =
  'M0 74C0 39.1161 0 21.6741 10.837 10.837C21.6741 0 39.1161 0 74 0H93C127.884 0 145.326 0 156.163 10.837C167 21.6741 167 39.1161 167 74V93C167 127.884 167 145.326 156.163 156.163C145.326 167 127.884 167 93 167H74C39.1161 167 21.6741 167 10.837 156.163C0 145.326 0 127.884 0 93V74Z';

export default function AppIconAvatar({ site, size, src, alt = '' }: AppIconAvatarProps) {
  const reactId = useId();
  const clipId = `app-icon-avatar-${reactId}`;
  const scale = size / ORIGINAL_SIZE;
  const iconSize = size * 0.5;
  const iconPosition = (size - iconSize) / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={PATH_D} transform={`scale(${scale})`} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {src ? (
          <image href={src} width={size} height={size} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <rect width={size} height={size} fill="currentColor" opacity="0.08" />

            <foreignObject x={iconPosition} y={iconPosition} width={iconSize} height={iconSize}>
              {site === 'blog' ? (
                <ArticleOutlinedIcon
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    color: 'currentColor',
                    opacity: 0.45,
                  }}
                />
              ) : (
                <InterestsRoundedIcon
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    color: 'currentColor',
                    opacity: 0.45,
                  }}
                />
              )}
            </foreignObject>
          </>
        )}
      </g>
    </svg>
  );
}
