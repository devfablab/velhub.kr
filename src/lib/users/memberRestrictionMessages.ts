export const memberRestrictionTypes = ['block', 'kick', 'ban'] as const;

export type MemberRestrictionType = (typeof memberRestrictionTypes)[number];

export type MemberRestrictionMessageSenderType = 'appellant' | 'staff';

export type MemberRestrictionMessage = {
  id: string;
  senderType: MemberRestrictionMessageSenderType;
  senderName: string;
  message: string;
  createdAt: string;
};

export type MemberRestrictionMessagesResponse = {
  siteName?: string;
  restrictionReason?: string;
  messages?: MemberRestrictionMessage[];
  error?: string;
};

export type MemberRestrictionMessageStatus =
  | 'appellant_sent'
  | 'appellant_new_reply'
  | 'staff_new_appeal'
  | 'staff_replied';

export function isMemberRestrictionType(value: unknown): value is MemberRestrictionType {
  return memberRestrictionTypes.includes(value as MemberRestrictionType);
}

export function getAppellantRestrictionMessageStatus(senderType: MemberRestrictionMessageSenderType | null) {
  if (senderType === 'appellant') {
    return 'appellant_sent' as const;
  }

  if (senderType === 'staff') {
    return 'appellant_new_reply' as const;
  }

  return null;
}

export function getStaffRestrictionMessageStatus(senderType: MemberRestrictionMessageSenderType | null) {
  if (senderType === 'appellant') {
    return 'staff_new_appeal' as const;
  }

  if (senderType === 'staff') {
    return 'staff_replied' as const;
  }

  return null;
}

export const memberRestrictionMessageStatusLabels: Record<MemberRestrictionMessageStatus, string> = {
  appellant_sent: '소명 보냄',
  appellant_new_reply: '신규 답변 받음',
  staff_new_appeal: '신규 소명 도착',
  staff_replied: '답변 보냄',
};

export function getRestrictionInitialMessageCreatedAt(
  messages: MemberRestrictionMessage[],
  fallbackCreatedAt: string,
) {
  const appellantMessages = messages.filter((message) => message.senderType === 'appellant');

  if (appellantMessages.length === 0) {
    return fallbackCreatedAt;
  }

  return appellantMessages.reduce((earliestCreatedAt, message) => {
    const earliestTime = new Date(earliestCreatedAt).getTime();
    const messageTime = new Date(message.createdAt).getTime();

    if (!Number.isFinite(earliestTime)) {
      return message.createdAt;
    }

    return Number.isFinite(messageTime) && messageTime < earliestTime ? message.createdAt : earliestCreatedAt;
  }, appellantMessages[0].createdAt);
}

