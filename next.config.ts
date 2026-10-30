import type { NextConfig } from 'next';
import path from 'path';

const r2ImageHostnames = [
  'dist.velhub.xyz',
  'avatars.dist.velhub.xyz',
  'blog-add-images.dist.velhub.xyz',
  'blog-communities.dist.velhub.xyz',
  'categories.dist.velhub.xyz',
  'community-answers.dist.velhub.xyz',
  'community-links.dist.velhub.xyz',
  'cover-images.dist.velhub.xyz',
  'lv-icons.dist.velhub.xyz',
  'manager-icons.dist.velhub.xyz',
  'og-images.dist.velhub.xyz',
  'posts.dist.velhub.xyz',
  'promotion-images.dist.velhub.xyz',
  'series.dist.velhub.xyz',
  'site-logos.dist.velhub.xyz',
  'site-ogs.dist.velhub.xyz',
];

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qfipuxidypbyzmajkybm.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      ...r2ImageHostnames.map((hostname) => ({
        protocol: 'https' as const,
        hostname,
        port: '',
        pathname: '/**',
      })),
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/vi_webp/**',
      },
    ],
  },
  sassOptions: {
    api: 'modern',
    silenceDeprecations: ['legacy-js-api'],
    includePaths: [path.join(__dirname, 'app')],
    outputStyle: process.env.NODE_ENV === 'production' ? 'compressed' : 'expanded',
    prependData: `
      @use 'designSystem.sass' as ds
    `,
  },
};

export default nextConfig;
