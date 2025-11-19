
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
                            description: `Similarity Score: ${(result.confidence * 100).toFixed(2)}%`,
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
                            description: `Voiceprint ${result.enrollmentCount} of ${REQUIRED_ENROLLMENTS} saved.`,
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
                            : `Enroll your voice to enable password-less authentication. You need to record your voice ${REQUIRED_ENROLLMENTS} times.`
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
                                        <span>Phrase to Read ({enrollmentCount + 1} / {REQUIRED_ENROLLMENTS})</span>
                                    </CardTitle>
                                    <CardDescription>Read the following phrase clearly into your microphone.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold text-center p-4 bg-background rounded-md">
                                        "{ENROLLMENT_PHRASES[currentPhraseIndex]}"
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
                                    <p className="text-sm text-muted-foreground">Confidence: {(lastVerificationResult.confidence * 100).toFixed(2)}%</p>
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
