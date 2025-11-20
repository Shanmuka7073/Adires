
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

// Safe JSON function
async function safeJson(resp: Response) {
    try {
        const text = await resp.text();
        return text ? JSON.parse(text) : {};
    } catch {
        return {};
    }
}

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
                // 1. Get registration options from API
                const respOptions = await fetch(`/api/auth/webauthn/generate-registration-options/${user.uid}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });

                const options = await safeJson(respOptions);

                if (!respOptions.ok) {
                    throw new Error(options.error || 'Failed to get registration options.');
                }

                // 2. Browser WebAuthn API
                const attestation = await startRegistration(options);

                // 3. Verify on backend
                const verificationResp = await fetch(`/api/auth/webauthn/verify-registration/${user.uid}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(attestation),
                });

                const verificationJSON = await safeJson(verificationResp);

                if (!verificationResp.ok) {
                    throw new Error(verificationJSON.error || 'Verification failed.');
                }

                if (verificationJSON.verified) {
                    toast({
                        title: 'Success!',
                        description: 'Your fingerprint has been registered.',
                    });
                } else {
                    throw new Error(verificationJSON.error || 'Verification failed.');
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
        return <p>Loading...</p>;
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
                            This uses the WebAuthn standard. Your fingerprint never leaves your device.
                        </AlertDescription>
                    </Alert>

                    <Button
                        onClick={handleRegister}
                        disabled={isRegistering}
                        className="w-full"
                        size="lg"
                    >
                        {isRegistering ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...
                            </>
                        ) : (
                            <>
                                <Fingerprint className="mr-2 h-4 w-4" /> Register This Device
                            </>
                        )}
                    </Button>

                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Note</AlertTitle>
                        <AlertDescription>
                            Each new device/browser must be registered separately. Removal UI coming soon.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
}
