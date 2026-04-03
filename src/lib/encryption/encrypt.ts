import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const initializationVectorLength = 16;

function getEncryptionKey() {
  const encryptionSecret = process.env.ENCRYPTION_SECRET;

  if (!encryptionSecret) {
    throw new Error('ENCRYPTION_SECRET가 설정되지 않았습니다.');
  }

  return crypto.createHash('sha256').update(encryptionSecret).digest();
}

export function encrypt(value: string) {
  const encryptionKey = getEncryptionKey();
  const initializationVector = crypto.randomBytes(initializationVectorLength);

  const cipher = crypto.createCipheriv(algorithm, encryptionKey, initializationVector);

  const encryptedBuffer = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

  const authenticationTag = cipher.getAuthTag();

  return [
    initializationVector.toString('hex'),
    authenticationTag.toString('hex'),
    encryptedBuffer.toString('hex'),
  ].join(':');
}
