import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl) {
  throw new Error('UPSTASH_REDIS_REST_URL이 설정되지 않았습니다.');
}

if (!redisToken) {
  throw new Error('UPSTASH_REDIS_REST_TOKEN이 설정되지 않았습니다.');
}

export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});
