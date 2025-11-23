
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Set the Permissions-Policy header using semicolons for broader compatibility.
  response.headers.set(
    'Permissions-Policy',
    'publickey-credentials-create=(self); publickey-credentials-get=(self)'
  );

  return response;
}

// Apply the middleware to all paths except for static assets and images.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
