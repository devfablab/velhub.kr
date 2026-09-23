'use client';

import { useEffect } from 'react';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import { useChannelWorksMember } from './ChannelWorksContext';

const CHANNEL_WORKS_PLUGIN_KEY = process.env.NEXT_PUBLIC_CHANNEL_WORKS_PLUGIN_KEY;
const CHANNEL_WORKS_SCRIPT_URL = 'https://cdn.channel.io/plugin/ch-plugin-web.js';

type ChannelCommand = (...args: unknown[]) => void;
type ChannelIO = ChannelCommand & {
  c?: (...args: unknown[]) => void;
  q?: unknown[][];
};

declare global {
  interface Window {
    ChannelIO?: ChannelIO;
    ChannelIOInitialized?: boolean;
  }
}

function initializeChannelIO() {
  if (window.ChannelIOInitialized) return;

  window.ChannelIOInitialized = true;

  const channelIO: ChannelIO = (...args: unknown[]) => {
    channelIO.c?.(...args);
  };

  channelIO.q = [];
  channelIO.c = (...args: unknown[]) => {
    channelIO.q?.push(args);
  };

  window.ChannelIO = channelIO;
}

export default function ChannelWorks() {
  const { isAuthenticated, isReady } = useAuthState();
  const member = useChannelWorksMember();

  useEffect(() => {
    if (!CHANNEL_WORKS_PLUGIN_KEY || !isReady) return;

    initializeChannelIO();

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${CHANNEL_WORKS_SCRIPT_URL}"]`);

    if (!existingScript) {
      const script = document.createElement('script');
      script.async = true;
      script.src = CHANNEL_WORKS_SCRIPT_URL;
      document.head.appendChild(script);
    }

    window.ChannelIO?.('shutdown');
    window.ChannelIO?.('boot', {
      pluginKey: CHANNEL_WORKS_PLUGIN_KEY,
      ...(isAuthenticated ? (member ?? {}) : {}),
    });

    return () => {
      window.ChannelIO?.('shutdown');
    };
  }, [isAuthenticated, isReady, member]);

  return null;
}
