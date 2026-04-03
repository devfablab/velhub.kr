import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tjejcolcmqterhhdfcub.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/post-images/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/vi/**',
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
