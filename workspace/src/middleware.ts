
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    'Permissions-Policy',
    'publickey-credentials-create=(self), publickey-credentials-get=(self)'
  );

  return response;
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/:path*',
}
