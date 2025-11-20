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
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';

const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
const rpName = 'LocalBasket';
const origin = process.env.NEXT_PUBLIC_ORIGIN || `https://${rpID}`;

async function getAuthenticators(userId: string): Promise<Authenticator[]> {
  const { db } = await getAdminServices();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) return [];
  const userData = userDoc.data() as AppUser;
  return userData.authenticators || [];
}

async function saveAuthenticator(userId: string, authenticator: Authenticator) {
  const { db } = await getAdminServices();
  const userRef = db.collection('users').doc(userId);
  const existingAuthenticators = await getAuthenticators(userId);
  await userRef.set(
    { authenticators: [...existingAuthenticators, authenticator] },
    { merge: true }
  );
}

export async function POST(request: NextRequest, { params }: { params: { route: string[] } }) {
  const { db, auth: adminAuth } = await getAdminServices();
  const route = params.route;

  // Safely parse JSON body — if the body is empty or invalid, fall back to {}
  let body: any = {};
  try {
    body = await request.json();
  } catch (err) {
    // If the incoming request has no JSON body, we continue with an empty object.
    body = {};
  }

  if (!route || route.length === 0) {
    return NextResponse.json({ error: 'Invalid route' }, { status: 400 });
  }

  const action = route[0];
  const userId = route.length > 1 ? route[1] : undefined;

  switch (action) {
    case 'generate-registration-options': {
      if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const user = userDoc.data() as AppUser;

      const userAuthenticators = await getAuthenticators(userId);

      const opts: GenerateRegistrationOptionsOpts = {
        rpName,
        rpID,
        userID: user.id,
        userName: user.email,
        timeout: 60000,
        attestationType: 'none',
        excludeCredentials: userAuthenticators.map((auth) => ({
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
      await db.collection('users').doc(userId).set({ currentChallenge: options.challenge }, { merge: true });

      return NextResponse.json(options);
    }

    case 'verify-registration': {
      if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const user = userDoc.data() as AppUser;

      const expectedChallenge = user.currentChallenge;
      if (!expectedChallenge) return NextResponse.json({ error: 'No challenge found for user' }, { status: 400 });
      
      let verification: VerifiedRegistrationResponse;
      try {
        const opts: VerifyRegistrationResponseOpts = {
          response: body,
          expectedChallenge: `${expectedChallenge}`,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
        };
        verification = await verifyRegistrationResponse(opts);
      } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error?.message || 'Verification failed' }, { status: 400 });
      }

      const { verified, registrationInfo } = verification;

      if (verified && registrationInfo) {
        const { credentialPublicKey, credentialID, counter } = registrationInfo;
        const newAuthenticator: Authenticator = {
          credentialID: isoBase64URL.fromBuffer(credentialID),
          credentialPublicKey: isoBase64URL.fromBuffer(credentialPublicKey),
          counter,
          transports: (body?.response?.transports as string[]) || [],
        };
        await saveAuthenticator(userId, newAuthenticator);
      }

      await db.collection('users').doc(userId).set({ currentChallenge: null }, { merge: true });
      return NextResponse.json({ verified });
    }
    
    case 'generate-authentication-options': {
      let user: AppUser | null = null;
      if (body.email) {
          const userSnapshot = await db.collection('users').where('email', '==', body.email).limit(1).get();
          if (!userSnapshot.empty) {
              const doc = userSnapshot.docs[0];
              user = { id: doc.id, ...doc.data() } as AppUser;
          }
      }

      if (!user) {
          return NextResponse.json({ error: 'User not found or no authenticators registered' }, { status: 404 });
      }

      const userAuthenticators = await getAuthenticators(user.id);
      if (userAuthenticators.length === 0) {
        return NextResponse.json({ error: 'No authenticators registered for this user' }, { status: 400 });
      }

      const opts: GenerateAuthenticationOptionsOpts = {
        timeout: 60000,
        allowCredentials: userAuthenticators.map(auth => ({
          id: isoBase64URL.toBuffer(auth.credentialID),
          type: 'public-key',
          transports: auth.transports,
        })),
        userVerification: 'preferred',
        rpID,
      };

      const options = await generateAuthenticationOptions(opts);
      await db.collection('users').doc(user.id).set({ currentChallenge: options.challenge }, { merge: true });

      return NextResponse.json(options);
    }
    
    case 'verify-authentication': {
        const { email } = body;
        if (!email) {
            return NextResponse.json({ error: 'Email is required for authentication verification' }, { status: 400 });
        }
        const userSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (userSnapshot.empty) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        const userDoc = userSnapshot.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() } as AppUser;

        const expectedChallenge = user.currentChallenge;
        if (!expectedChallenge) return NextResponse.json({ error: 'No challenge found for user' }, { status: 400 });
        
        const userAuthenticators = await getAuthenticators(user.id);

        // assertion ID might be provided as `body.id` or `body.rawId` depending on client.
        const assertionId = body.id || body.rawId;
        if (!assertionId) {
          return NextResponse.json({ error: 'Authenticator ID is required in body.id or body.rawId' }, { status: 400 });
        }

        const authenticator = userAuthenticators.find(auth => auth.credentialID === assertionId);
        
        if (!authenticator) {
            return NextResponse.json({ error: `Could not find authenticator with ID ${assertionId}` }, { status: 404 });
        }
        
        let verification: VerifiedAuthenticationResponse;
        try {
            const opts: VerifyAuthenticationResponseOpts = {
                response: body,
                expectedChallenge: `${expectedChallenge}`,
                expectedOrigin: origin,
                expectedRPID: rpID,
                authenticator: {
                  ...authenticator,
                  credentialID: isoBase64URL.toBuffer(authenticator.credentialID),
                  credentialPublicKey: isoBase64URL.toBuffer(authenticator.credentialPublicKey),
                },
                requireUserVerification: true,
            };
            verification = await verifyAuthenticationResponse(opts);
        } catch (error: any) {
            console.error(error);
            return NextResponse.json({ error: error?.message || 'Authentication verification failed' }, { status: 400 });
        }

        const { verified, authenticationInfo } = verification;
        
        if (verified) {
            const { newCounter } = authenticationInfo;
            await db.collection('users').doc(user.id).set({ currentChallenge: null }, { merge: true });

            const updatedAuthenticator = { ...authenticator, counter: newCounter };
            const otherAuthenticators = userAuthenticators.filter(auth => auth.credentialID !== assertionId);
            await db.collection('users').doc(user.id).update({
                authenticators: [...otherAuthenticators, updatedAuthenticator],
            });
            
            const customToken = await adminAuth.createCustomToken(user.id);
            
            return NextResponse.json({ verified: true, customToken });
        }
        
        return NextResponse.json({ verified: false }, { status: 401 });
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

// For safety, do NOT forward GET to POST (which expects a JSON body).
// Return a clear message for GET — change this if you want GET behavior implemented.
export async function GET(request: NextRequest, context: { params: { route: string[] } }) {
  return NextResponse.json({ error: 'Use POST for this endpoint' }, { status: 405 });
}