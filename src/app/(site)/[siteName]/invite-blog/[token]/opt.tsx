'use client';

import InviteAcceptance, { type InviteAcceptanceResponse } from '@/components/service/common/InviteAcceptance';

export type InviteResponse = InviteAcceptanceResponse;

export default function Opt(props: {
  siteName: string;
  token: string;
  initialData: InviteResponse | null;
  initialError: string;
}) {
  return <InviteAcceptance {...props} inviteType="blog" />;
}
