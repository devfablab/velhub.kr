import { createLookupHash } from '@/lib/encryption/encrypt';

export function createSecurityPinHash(userId: string, pin: string) {
  return createLookupHash(`security-pin:${userId}:${pin}`);
}
