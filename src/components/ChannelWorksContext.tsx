'use client';

import { createContext, useContext } from 'react';
import type { ChannelWorksMember } from '@/lib/channelWorks/member.server';

const ChannelWorksMemberContext = createContext<ChannelWorksMember | null>(null);

export function ChannelWorksMemberProvider({
  children,
  member,
}: {
  children: React.ReactNode;
  member: ChannelWorksMember | null;
}) {
  return <ChannelWorksMemberContext.Provider value={member}>{children}</ChannelWorksMemberContext.Provider>;
}

export function useChannelWorksMember() {
  return useContext(ChannelWorksMemberContext);
}
