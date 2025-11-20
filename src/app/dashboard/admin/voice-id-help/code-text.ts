
export const voiceIdCodeText = [
    {
        path: 'src/lib/voice-id.ts',
        content: `
'use server';
/**
 * @fileOverview A library for creating and verifying voiceprints for user authentication without external AI.
 */

import { getAdminServices } from '@/firebase/admin-init';
import type { Voiceprint, CreateVoiceprintInput, CreateVoiceprintOutput, VerifyVoiceprintInput, VerifyVoiceprintOutput } from '@/lib/types';

// --- CORE FUNCTIONS ---

/**
 * Extracts a simple feature vector from an audio data URI.
 * This is a basic simulation and NOT a secure biometric analysis.
 * @param audioDataUri The base64 encoded audio data.
 * @returns A promise that resolves to an array of numbers representing the voice features.
 */
async function analyzeVoiceAndExtractFeatures(audioDataUri: string): Promise<number[]> {
  // In this placeholder, we're generating a "feature vector" based on the length
  // and some simple characteristics of the base64 string.
  const base64 = audioDataUri.split(',')[1];
  if (!base64) {
      throw new Error("Invalid audio data URI: Missing base64 content.");
  }

  const features = [
    base64.length,
    base64.substring(0, 50).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0),
    base64.substring(base64.length - 50).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ];

  // Add some "randomness" to simulate real-world variability
  for (let i = 0; i < 5; i++) {
    features.push(Math.sin(base64.length * i) * 1000);
  }

  return features;
}

/**
 * Creates or updates a user's voiceprint from an audio sample.
 * This is done by averaging feature vectors from multiple enrollments.
 */
export async function createVoiceprint(input: CreateVoiceprintInput): Promise<CreateVoiceprintOutput> {
    try {
        const { db } = await getAdminServices();
        const voiceprintRef = db.collection('voiceprints').doc(input.userId);

        const newEnrollmentFeatures = await analyzeVoiceAndExtractFeatures(input.audioDataUri);

        const doc = await voiceprintRef.get();
        let existingEnrollments: number[][] = [];

        if (doc.exists) {
            existingEnrollments = (doc.data() as Voiceprint).enrollments || [];
        }

        existingEnrollments.push(newEnrollmentFeatures);
        
        const featureCount = existingEnrollments[0].length;
        const finalVoiceprint = new Array(featureCount).fill(0);
        for (const enrollment of existingEnrollments) {
            for (let i = 0; i < featureCount; i++) {
                finalVoiceprint[i] += enrollment[i] || 0;
            }
        }
        for (let i = 0; i < featureCount; i++) {
            finalVoiceprint[i] /= existingEnrollments.length;
        }

        const dataToSave: Partial<Voiceprint> = {
            userId: input.userId,
            enrollments: existingEnrollments,
            voiceprint: finalVoiceprint,
            lastUpdatedAt: new Date().toISOString(),
        };

        if (!doc.exists) {
            dataToSave.createdAt = new Date().toISOString();
        }

        await voiceprintRef.set(dataToSave, { merge: true });

        return {
            isSuccess: true,
            enrollmentCount: existingEnrollments.length,
        };

    } catch (error: any) {
        console.error("Error in createVoiceprint:", error);
        return {
            isSuccess: false,
            enrollmentCount: 0,
            error: error.message || "An unknown error occurred.",
        };
    }
}


/**
 * Verifies a new audio sample against a user's stored voiceprint.
 */
export async function verifyVoiceprint(input: VerifyVoiceprintInput): Promise<VerifyVoiceprintOutput> {
    const SIMILARITY_THRESHOLD = 0.95; // 95% similarity required for a match

    try {
        const { db } = await getAdminServices();
        const voiceprintRef = db.collection('voiceprints').doc(input.userId);

        const docSnap = await voiceprintRef.get();
        if (!docSnap.exists()) {
            return { isMatch: false, confidence: 0, error: 'User has not enrolled a voiceprint.' };
        }

        const storedVoiceprint = (docSnap.data() as Voiceprint).voiceprint;
        if (!storedVoiceprint || storedVoiceprint.length === 0) {
             return { isMatch: false, confidence: 0, error: 'Stored voiceprint is invalid or empty.' };
        }

        const newFeatures = await analyzeVoiceAndExtractFeatures(input.audioDataUri);

        // Calculate cosine similarity between the two feature vectors
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;
        for (let i = 0; i < storedVoiceprint.length; i++) {
            dotProduct += storedVoiceprint[i] * (newFeatures[i] || 0);
            magnitudeA += storedVoiceprint[i] * storedVoiceprint[i];
            magnitudeB += (newFeatures[i] || 0) * (newFeatures[i] || 0);
        }
        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return { isMatch: false, confidence: 0, error: 'Cannot compare with a zero-magnitude vector.' };
        }

        const confidence = dotProduct / (magnitudeA * magnitudeB);
        
        return {
            isMatch: confidence >= SIMILARITY_THRESHOLD,
            confidence: confidence,
        };

    } catch (error: any) {
        console.error("Error in verifyVoiceprint:", error);
        return {
            isMatch: false,
            confidence: 0,
            error: error.message || 'An unknown error occurred during verification.',
        };
    }
}
`,
    },
    {
        path: 'src/app/dashboard/customer/voice-id/page.tsx',
        content: `
'use client';

import { useState, useMemo, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Voiceprint } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { createVoiceprint, verifyVoiceprint } from '@/lib/voice-id';
import { Mic, Loader2, ShieldCheck, List, Sparkles, RefreshCw } from 'lucide-react';
import { VoiceIdCommander } from './voice-id-commander';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const REQUIRED_ENROLLMENTS = 3;
const ENROLLMENT_PHRASES = [
    "My voice is my password, and I will use it to log in.",
    "LocalBasket is the best app for hyperlocal grocery delivery.",
    "Never forget your password again, your voice is your key."
];

export default function VoiceIdPage() {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const [isProcessing, startProcessing] = useTransition();

    const [isRecording, setIsRecording] = useState(false);
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    const [lastVerificationResult, setLastVerificationResult] = useState<{ isMatch: boolean; confidence: number; } | null>(null);

    const voiceprintDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'voiceprints', user.uid);
    }, [firestore, user]);

    const { data: voiceprintData, isLoading: isVoiceprintLoading } = useDoc<Voiceprint>(voiceprintDocRef);

    const enrollmentCount = voiceprintData?.enrollments?.length || 0;
    const isEnrolled = enrollmentCount >= REQUIRED_ENROLLMENTS;

    const handleRecordingComplete = (audioBlob: Blob) => {
        if (!firestore || !user) return;
        
        startProcessing(async () => {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = reader.result as string;

                if (isEnrolled) {
                    // --- VERIFICATION MODE ---
                    setLastVerificationResult(null);
                    const result = await verifyVoiceprint({ userId: user.uid, audioDataUri: base64Audio });
                    if (result.error) {
                         toast({ variant: 'destructive', title: 'Verification Failed', description: result.error });
                    } else {
                        setLastVerificationResult({ isMatch: result.isMatch, confidence: result.confidence });
                        toast({
                            title: result.isMatch ? 'Voice Matched!' : 'Voice Not Recognized',
                            description: \`Similarity Score: \${(result.confidence * 100).toFixed(2)}%\`,
                            variant: result.isMatch ? 'default' : 'destructive',
                        });
                    }
                } else {
                    // --- ENROLLMENT MODE ---
                    const result = await createVoiceprint({ 
                        userId: user.uid, 
                        audioDataUri: base64Audio 
                    });

                    if (result.isSuccess) {
                        toast({
                            title: 'Enrollment Successful!',
                            description: \`Voiceprint \${result.enrollmentCount} of \${REQUIRED_ENROLLMENTS} saved.\`,
                        });
                        setCurrentPhraseIndex(prev => (prev + 1) % ENROLLMENT_PHRASES.length);
                    } else {
                        toast({
                            variant: 'destructive',
                            title: 'Enrollment Failed',
                            description: result.error || 'Could not process your voice.',
                        });
                    }
                }
            };
        });
    };

    const handleResetVerification = () => {
        setLastVerificationResult(null);
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2">
                        <Sparkles className="h-8 w-8 text-primary" />
                        <span>Voice ID</span>
                    </CardTitle>
                    <CardDescription>
                        {isEnrolled 
                            ? "Your voiceprint is enrolled. Record your voice to test the verification." 
                            : \`Enroll your voice to enable password-less authentication. You need to record your voice \${REQUIRED_ENROLLMENTS} times.\`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {!isEnrolled ? (
                        <>
                            <Card className="bg-muted/50">
                                 <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                         <List className="h-5 w-5" />
                                        <span>Phrase to Read (\${enrollmentCount + 1} / \${REQUIRED_ENROLLMENTS})</span>
                                    </CardTitle>
                                    <CardDescription>Read the following phrase clearly into your microphone.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold text-center p-4 bg-background rounded-md">
                                        "\${ENROLLMENT_PHRASES[currentPhraseIndex]}"
                                    </p>
                                </CardContent>
                            </Card>
                            <Progress value={(enrollmentCount / REQUIRED_ENROLLMENTS) * 100} className="w-full" />
                        </>
                    ) : (
                        <Alert variant="default" className="bg-green-50 border-green-200">
                             <ShieldCheck className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-800">Enrollment Complete!</AlertTitle>
                            <AlertDescription className="text-green-700">
                                You can now verify your identity by reading any of the enrollment phrases.
                            </AlertDescription>
                        </Alert>
                    )}
                    
                    {lastVerificationResult && isEnrolled && (
                         <Card className={lastVerificationResult.isMatch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                            <CardHeader>
                                <CardTitle className="text-lg">Verification Result</CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="font-bold text-xl">{lastVerificationResult.isMatch ? 'MATCH' : 'NO MATCH'}</p>
                                    <p className="text-sm text-muted-foreground">Confidence: \${(lastVerificationResult.confidence * 100).toFixed(2)}%</p>
                                </div>
                                <Button onClick={handleResetVerification} variant="outline" size="sm">
                                    <RefreshCw className="mr-2 h-4 w-4" /> Try Again
                                </Button>
                            </CardContent>
                        </Card>
                    )}


                    <div className="flex flex-col items-center gap-4">
                        <VoiceIdCommander
                            isRecording={isRecording}
                            setIsRecording={setIsRecording}
                            onRecordingComplete={handleRecordingComplete}
                            disabled={isProcessing || (isEnrolled && !!lastVerificationResult)}
                        />

                        {isProcessing && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <p>Processing your voiceprint...</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
`,
    }
];
