export function clearChannelWorksCookies() {
  const cookieNames = document.cookie
    .split(';')
    .map((cookie) => cookie.split('=', 1)[0]?.trim())
    .filter((cookieName): cookieName is string => Boolean(cookieName?.startsWith('ch-')));

  for (const cookieName of cookieNames) {
    document.cookie = `${cookieName}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}
