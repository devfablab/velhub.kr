'use client';

import { useId } from 'react';

type AppIconAvatarProps = {
  imageSize: number;
  svgSize: number;
  src: string;
  alt?: string;
};

const ORIGINAL_SIZE = 167;

const PATH_D =
  'M0 74C0 39.1161 0 21.6741 10.837 10.837C21.6741 0 39.1161 0 74 0H93C127.884 0 145.326 0 156.163 10.837C167 21.6741 167 39.1161 167 74V93C167 127.884 167 145.326 156.163 156.163C145.326 167 127.884 167 93 167H74C39.1161 167 21.6741 167 10.837 156.163C0 145.326 0 127.884 0 93V74Z';

export default function AppIconAvatar({ imageSize, svgSize, src, alt = '' }: AppIconAvatarProps) {
  const reactId = useId();
  const clipId = `app-icon-avatar-${reactId}`;
  const scale = svgSize / ORIGINAL_SIZE;

  return (
    <svg
      width={imageSize}
      height={imageSize}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
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

      <image
        href={src}
        width={svgSize}
        height={svgSize}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}
