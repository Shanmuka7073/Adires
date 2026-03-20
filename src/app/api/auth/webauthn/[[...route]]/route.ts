import { NextResponse } from 'next/server';

/**
 * WEB AUTHN API ROUTE (DISABLED)
 * Biometric login has been removed from the application.
 * All requests to this endpoint will return a 404.
 */
export async function POST() {
  return NextResponse.json({ error: 'WebAuthn functionality removed.' }, { status: 404 });
}

export async function GET() {
  return NextResponse.json({ error: 'Endpoint not found.' }, { status: 404 });
}
