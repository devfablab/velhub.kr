'use client';

import { useEffect } from 'react';
import { useAuthState } from '@/components/auth/AuthStateProvider';

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

type ChannelMember = {
  memberId: string;
  memberHash?: string;
  profile: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
};

type ChannelMemberResponse = {
  member: ChannelMember | null;
};

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
  const { authVersion, isReady } = useAuthState();

  useEffect(() => {
    if (!CHANNEL_WORKS_PLUGIN_KEY || !isReady) return;

    const abortController = new AbortController();

    initializeChannelIO();

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${CHANNEL_WORKS_SCRIPT_URL}"]`);

    if (!existingScript) {
      const script = document.createElement('script');
      script.async = true;
      script.src = CHANNEL_WORKS_SCRIPT_URL;
      document.head.appendChild(script);
    }

    async function bootChannelWorks() {
      let member: ChannelMember | null = null;

      try {
        const response = await fetch('/api/channel-works/member', {
          cache: 'no-store',
          credentials: 'include',
          signal: abortController.signal,
        });

        if (response.ok) {
          const result = (await response.json()) as ChannelMemberResponse;
          member = result.member;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }

      if (abortController.signal.aborted) return;

      window.ChannelIO?.('shutdown');
      window.ChannelIO?.('boot', {
        pluginKey: CHANNEL_WORKS_PLUGIN_KEY,
        ...(member ?? {}),
      });
    }

    void bootChannelWorks();

    return () => {
      abortController.abort();
      window.ChannelIO?.('shutdown');
    };
  }, [authVersion, isReady]);

  return null;
}
