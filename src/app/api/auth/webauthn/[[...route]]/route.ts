
import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';

import { getAdminServices } from '@/firebase/admin-init';
import type { User as AppUser, Authenticator } from '@/lib/types';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

// ============================
// SAFE JSON PARSER
// ============================
async function safeJson(req: NextRequest) {
  try {
    const txt = await req.text();
    return txt ? JSON.parse(txt) : {};
  } catch {
    return {};
  }
}

// ============================
// FIRESTORE HELPERS
// ============================
async function getAuthenticators(userId: string): Promise<Authenticator[]> {
  const { db } = await getAdminServices();
  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) return [];
  return doc.data()?.authenticators || [];
}

async function saveAuthenticator(userId: string, auth: Authenticator) {
  const { db } = await getAdminServices();
  const existing = await getAuthenticators(userId);
  await db.collection('users').doc(userId).set(
    {
      authenticators: [...existing, auth],
    },
    { merge: true }
  );
}

// ============================
// WEB AUTHN MAIN HANDLER
// ============================
export async function POST(
  request: NextRequest,
  { params }: { params: { route: string[] } }
) {
  try {
    const { db, auth: adminAuth } = await getAdminServices();
    const host = request.headers.get('host');

    if (!host) {
      return NextResponse.json({ error: 'Missing Host header' }, { status: 400 });
    }

    // ===============================================
    // FIX RP ID AND ORIGIN (SUPPORT localhost + 127)
    // ===============================================
    const hostname = host.split(':')[0];

    let protocol = hostname === 'localhost' || hostname === '127.0.0.1'
      ? 'http'
      : 'https';

    const rpID = hostname;
    const origin = `${protocol}://${host}`;
    const rpName = 'LocalBasket';

    const route = params.route;
    if (!route || route.length === 0) {
      return NextResponse.json({ error: 'Invalid route' }, { status: 400 });
    }

    const body = await safeJson(request);
    const action = route[0];
    const userId = route[1];

    // ========================================
    // GENERATE REGISTRATION OPTIONS
    // ========================================
    if (action === 'generate-registration-options') {
      if (!userId)
        return NextResponse.json({ error: 'User ID missing' }, { status: 400 });

      const doc = await db.collection('users').doc(userId).get();
      if (!doc.exists)
        return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const user = doc.data() as AppUser;
      const existingAuth = await getAuthenticators(userId);

      const opts: GenerateRegistrationOptionsOpts = {
        rpName,
        rpID,
        userID: Buffer.from(userId, 'utf-8'),
        userName: user.email,
        timeout: 60000,
        attestationType: 'none',
        excludeCredentials: existingAuth.map((auth) => ({
          id: isoBase64URL.toBuffer(auth.credentialID),
          type: 'public-key',
          transports: auth.transports,
        })),
        authenticatorSelection: {
          residentKey: 'discouraged',
          userVerification: 'preferred',
        },
      };

      const options = await generateRegistrationOptions(opts);

      await db.collection('users').doc(userId).set(
        { currentChallenge: options.challenge },
        { merge: true }
      );

      return NextResponse.json(options);
    }

    // ========================================
    // VERIFY REGISTRATION
    // ========================================
    if (action === 'verify-registration') {
      if (!userId)
        return NextResponse.json({ error: 'User ID missing' }, { status: 400 });

      const doc = await db.collection('users').doc(userId).get();
      if (!doc.exists)
        return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const user = doc.data() as AppUser;
      const challenge = user.currentChallenge;

      if (!challenge)
        return NextResponse.json({ error: 'No challenge found' }, { status: 400 });

      let verification: VerifiedRegistrationResponse;

      try {
        const opts: VerifyRegistrationResponseOpts = {
          response: body,
          expectedChallenge: `${challenge}`,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
        };

        verification = await verifyRegistrationResponse(opts);
      } catch (err: any) {
        console.error('REGISTRATION VERIFY ERROR:', err);
        return NextResponse.json(
          { error: err?.message || 'Registration verification failed' },
          { status: 400 }
        );
      }

      const { verified, registrationInfo } = verification;

      if (verified && registrationInfo) {
        const { credentialPublicKey, credentialID, counter } = registrationInfo;

        const newAuthenticator: Authenticator = {
          credentialID: isoBase64URL.fromBuffer(credentialID),
          credentialPublicKey: isoBase64URL.fromBuffer(credentialPublicKey),
          counter,
          transports: body?.response?.transports || [],
        };

        await saveAuthenticator(userId, newAuthenticator);
      }

      await db
        .collection('users')
        .doc(userId)
        .set({ currentChallenge: null }, { merge: true });

      return NextResponse.json({ verified });
    }

    // ========================================
    // GENERATE AUTHENTICATION OPTIONS
    // ========================================
    if (action === 'generate-authentication-options') {
      const email = body.email;

      if (!email)
        return NextResponse.json({ error: 'Email required' }, { status: 400 });

      const snap = await db
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (snap.empty)
        return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const userDoc = snap.docs[0];
      const user = { id: userDoc.id, ...userDoc.data() } as AppUser;
      const auths = await getAuthenticators(user.id);

      if (auths.length === 0) {
        return NextResponse.json(
          { error: 'No authenticators registered' },
          { status: 400 }
        );
      }

      const opts: GenerateAuthenticationOptionsOpts = {
        timeout: 60000,
        rpID,
        userVerification: 'preferred',
        allowCredentials: auths.map((auth) => ({
          id: isoBase64URL.toBuffer(auth.credentialID),
          type: 'public-key',
          transports: auth.transports,
        })),
      };

      const options = await generateAuthenticationOptions(opts);

      await db
        .collection('users')
        .doc(user.id)
        .set({ currentChallenge: options.challenge }, { merge: true });

      return NextResponse.json(options);
    }

    // ========================================
    // VERIFY AUTHENTICATION
    // ========================================
    if (action === 'verify-authentication') {
      const { email } = body;

      if (!email)
        return NextResponse.json({ error: 'Email required' }, { status: 400 });

      const snap = await db
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (snap.empty)
        return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const doc = snap.docs[0];
      const user = { id: doc.id, ...doc.data() } as AppUser;
      const challenge = user.currentChallenge;

      if (!challenge)
        return NextResponse.json(
          { error: 'No challenge found' },
          { status: 400 }
        );

      const authenticatorId = body.id || body.rawId;

      if (!authenticatorId)
        return NextResponse.json(
          { error: 'Authenticator ID missing' },
          { status: 400 }
        );

      const auths = await getAuthenticators(user.id);
      const selected = auths.find((a) => a.credentialID === authenticatorId);

      if (!selected)
        return NextResponse.json(
          { error: 'Authenticator not found' },
          { status: 404 }
        );

      let verification: VerifiedAuthenticationResponse;

      try {
        const opts: VerifyAuthenticationResponseOpts = {
          response: body,
          expectedChallenge: `${challenge}`,
          expectedOrigin: origin,
          expectedRPID: rpID,
          authenticator: {
            ...selected,
            credentialID: isoBase64URL.toBuffer(selected.credentialID),
            credentialPublicKey: isoBase64URL.toBuffer(
              selected.credentialPublicKey
            ),
          },
          requireUserVerification: true,
        };

        verification = await verifyAuthenticationResponse(opts);
      } catch (err: any) {
        console.error('AUTH VERIFY ERROR:', err);
        return NextResponse.json(
          { error: err?.message || 'Authentication failed' },
          { status: 400 }
        );
      }

      const { verified, authenticationInfo } = verification;

      if (!verified) return NextResponse.json({ verified: false }, { status: 401 });

      const updated = {
        ...selected,
        counter: authenticationInfo.newCounter,
      };

      const remaining = auths.filter(
        (a) => a.credentialID !== selected.credentialID
      );

      await db
        .collection('users')
        .doc(user.id)
        .update({ authenticators: [...remaining, updated] });

      await db
        .collection('users')
        .doc(user.id)
        .set({ currentChallenge: null }, { merge: true });

      const customToken = await adminAuth.createCustomToken(user.id);

      return NextResponse.json({
        verified: true,
        customToken,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('MAIN ROUTE ERROR:', error);
    return NextResponse.json(
      { error: error?.message || 'Unhandled API error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 });
}
