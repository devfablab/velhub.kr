export function getNotFoundPageMessage(actualMessage?: string) {
  const message = '존재하지 않는 페이지입니다.';

  if (process.env.NODE_ENV !== 'development' || !actualMessage) {
    return message;
  }

  return `${message} (${actualMessage})`;
}
