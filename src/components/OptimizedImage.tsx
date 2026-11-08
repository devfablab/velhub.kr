import type { CSSProperties } from 'react';
import Image from 'next/image';

type Props = {
  src: string | null | undefined;
  width?: number | null;
  height?: number | null;
  sizes: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
};

function canOptimize(src: string) {
  try {
    const { hostname, pathname } = new URL(src);

    if (pathname.toLowerCase().endsWith('.svg')) return false;

    return (
      hostname === 'dist.velhub.xyz' ||
      hostname.endsWith('.dist.velhub.xyz') ||
      (hostname === 'qfipuxidypbyzmajkybm.supabase.co' && pathname.startsWith('/storage/v1/object/public/')) ||
      (hostname === 'i.ytimg.com' && pathname.startsWith('/vi_webp/')) ||
      hostname === 'raw.githubusercontent.com'
    );
  } catch {
    return false;
  }
}

export function getHeightBasedSizes(
  displayHeight: number,
  width: number | null | undefined,
  height: number | null | undefined,
  maxWidth?: number,
) {
  if (!width || !height) return `${maxWidth ?? displayHeight}px`;

  const displayWidth = Math.ceil((displayHeight * width) / height);
  return `${maxWidth ? Math.min(displayWidth, maxWidth) : displayWidth}px`;
}

export default function OptimizedImage({ src, width, height, sizes, alt = '', className, style }: Props) {
  if (!src) return null;

  if (width && height && canOptimize(src)) {
    return (
      <Image src={src} alt={alt} width={width} height={height} sizes={sizes} className={className} style={style} />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} style={style} />;
}
