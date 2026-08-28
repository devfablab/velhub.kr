import type { NextRequest, NextResponse } from 'next/server';

export function clearChannelWorksResponseCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('ch-')) {
      response.cookies.delete(cookie.name);
    }
  }
}
