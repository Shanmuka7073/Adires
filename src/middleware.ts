
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Set the Permissions-Policy header to allow WebAuthn features for the document's own origin.
  // Using semicolons for the value is a more compatible syntax.
  response.headers.set(
    'Permissions-Policy',
    'publickey-credentials-create=(self); publickey-credentials-get=(self)'
  );

  return response;
}

// This matcher ensures the middleware runs on all pages and API routes,
// while excluding static files and internal Next.js assets.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
