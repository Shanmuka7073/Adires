
export const fingerprintCodeText = [
    {
        path: 'src/app/api/auth/webauthn/[[...route]]/route.ts',
        content: `
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
const origin = process.env.NEXT_PUBLIC_ORIGIN || \`https://\${rpID}\`;


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
  const body = await request.json();

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
          expectedChallenge: \`\${expectedChallenge}\`,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
        };
        verification = await verifyRegistrationResponse(opts);
      } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      const { verified, registrationInfo } = verification;

      if (verified && registrationInfo) {
        const { credentialPublicKey, credentialID, counter } = registrationInfo;
        const newAuthenticator: Authenticator = {
          credentialID: isoBase64URL.fromBuffer(credentialID),
          credentialPublicKey: isoBase64URL.fromBuffer(credentialPublicKey), // Convert to Base64 string
          counter,
          transports: body.response.transports || [],
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
        const authenticator = userAuthenticators.find(auth => auth.credentialID === body.id);
        
        if (!authenticator) {
            return NextResponse.json({ error: \`Could not find authenticator with ID \${body.id}\` }, { status: 404 });
        }
        
        let verification: VerifiedAuthenticationResponse;
        try {
            const opts: VerifyAuthenticationResponseOpts = {
                response: body,
                expectedChallenge: \`\${expectedChallenge}\`,
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
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        const { verified, authenticationInfo } = verification;
        
        if (verified) {
            const { newCounter } = authenticationInfo;
            await db.collection('users').doc(user.id).set({ currentChallenge: null }, { merge: true });

            const updatedAuthenticator = { ...authenticator, counter: newCounter };
            const otherAuthenticators = userAuthenticators.filter(auth => auth.credentialID !== body.id);
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

// Handler for all routes, since this is a catch-all route.
export async function GET(request: NextRequest, context: { params: { route: string[] } }) {
    return POST(request, context);
}
`,
    },
    {
        path: 'src/app/dashboard/customer/fingerprint/page.tsx',
        content: `
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function FingerprintRegistrationPage() {
    const { user, isUserLoading } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [isRegistering, startRegistrationTransition] = useTransition();

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login?redirectTo=/dashboard/customer/fingerprint');
        }
    }, [isUserLoading, user, router]);

    const handleRegister = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'You must be logged in to register.' });
            return;
        }

        startRegistrationTransition(async () => {
            try {
                // 1. Get registration options from the server
                const respOptions = await fetch(\`/api/auth/webauthn/generate-registration-options/\${user.uid}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });

                const options = await respOptions.json();

                if (!respOptions.ok) {
                    throw new Error(options.error || 'Failed to get registration options.');
                }

                // 2. Pass options to the browser's WebAuthn API
                const attestation = await startRegistration(options);

                // 3. Send the response to the server for verification
                const verificationResp = await fetch(\`/api/auth/webauthn/verify-registration/\${user.uid}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(attestation),
                });
                
                const verificationJSON = await verificationResp.json();

                if (!verificationResp.ok) {
                    throw new Error(verificationJSON.error || 'Failed to verify registration.');
                }

                if (verificationJSON && verificationJSON.verified) {
                    toast({
                        title: 'Success!',
                        description: 'Your fingerprint has been registered.',
                    });
                } else {
                    throw new Error(verificationJSON.error || 'Failed to verify registration.');
                }
            } catch (error: any) {
                console.error(error);
                toast({
                    variant: 'destructive',
                    title: 'Registration Failed',
                    description: error.message || 'An unknown error occurred.',
                });
            }
        });
    };

    if (isUserLoading) {
        return <p>Loading...</p>
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2">
                        <Fingerprint className="h-8 w-8 text-primary" />
                        <span>Manage Fingerprint Login</span>
                    </CardTitle>
                    <CardDescription>
                        Register your device to enable secure, passwordless login using your fingerprint or other biometrics.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>How it works</AlertTitle>
                        <AlertDescription>
                            This uses the WebAuthn standard, which creates a secure key on your device. Your fingerprint never leaves your device; it only unlocks this key.
                        </AlertDescription>
                    </Alert>
                    <Button
                        onClick={handleRegister}
                        disabled={isRegistering}
                        className="w-full"
                        size="lg"
                    >
                        {isRegistering ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...</>
                        ) : (
                            <><Fingerprint className="mr-2 h-4 w-4" /> Register This Device</>
                        )}
                    </Button>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Note</AlertTitle>
                        <AlertDescription>
                            You will need to register each new device or browser you wish to log in from. Registered authenticators cannot be removed from this UI yet.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
}
`,
    }
];
