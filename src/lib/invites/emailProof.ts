import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function createInviteEmailProof() {
  const proof = randomBytes(32).toString('base64url');
  return {
    proof,
    proofHash: hashInviteEmailProof(proof),
  };
}

export function hashInviteEmailProof(proof: string) {
  return createHash('sha256').update(proof).digest('hex');
}

export function verifyInviteEmailProof(proof: string, expectedHash: string) {
  const actualBuffer = Buffer.from(hashInviteEmailProof(proof), 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
