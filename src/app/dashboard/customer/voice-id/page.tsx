
'use client';

import { useState, useMemo, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Voiceprint } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { createVoiceprint } from '@/ai/flows/voice-id-flow';
import { Mic, Loader2, ShieldCheck, List, Sparkles } from 'lucide-react';
import { VoiceIdCommander } from './voice-id-commander';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

    // State for recording and UI
    const [isRecording, setIsRecording] = useState(false);
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);

    const voiceprintDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'voiceprints', user.uid);
    }, [firestore, user]);

    const { data: voiceprintData, isLoading: isVoiceprintLoading } = useDoc<Voiceprint>(voiceprintDocRef);

    const enrollmentCount = voiceprintData?.enrollments?.length || 0;
    const isEnrolled = enrollmentCount >= REQUIRED_ENROLLMENTS;

    const handleNewRecording = (audioBlob: Blob) => {
        if (!firestore || !user) return;
        
        startProcessing(async () => {
            try {
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = reader.result as string;
                    
                    const result = await createVoiceprint({ 
                        userId: user.uid, 
                        audioDataUri: base64Audio 
                    });

                    if (result.isSuccess) {
                        toast({
                            title: 'Enrollment Successful!',
                            description: `Voiceprint ${result.enrollmentCount} of ${REQUIRED_( ENROLLMENTS)} saved.`,
                        });
                        setCurrentPhraseIndex(prev => (prev + 1) % ENROLLMENT_PHRASES.length);
                    } else {
                        toast({
                            variant: 'destructive',
                            title: 'Enrollment Failed',
                            description: result.error || 'Could not process your voice.',
                        });
                    }
                };

            } catch (error) {
                console.error("Voiceprint creation failed:", error);
                toast({
                    variant: 'destructive',
                    title: 'An Error Occurred',
                    description: 'Could not connect to the voice processing service.',
                });
            }
        });
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2">
                        <Sparkles className="h-8 w-8 text-primary" />
                        <span>Voice ID Enrollment</span>
                    </CardTitle>
                    <CardDescription>
                        Enroll your voice to enable password-less authentication. You need to record your voice {REQUIRED_ENROLLMENTS} times.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {isEnrolled ? (
                        <Alert variant="default" className="bg-green-50 border-green-200">
                             <ShieldCheck className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-800">Enrollment Complete!</AlertTitle>
                            <AlertDescription className="text-green-700">
                                You have successfully enrolled your voice. You can now use it for authentication.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Card className="bg-muted/50">
                             <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                     <List className="h-5 w-5" />
                                    <span>Phrases to Read</span>
                                </CardTitle>
                                <CardDescription>Read the following phrase clearly into your microphone.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-lg font-semibold text-center p-4 bg-background rounded-md">
                                    "{ENROLLMENT_PHRASES[currentPhraseIndex]}"
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex flex-col items-center gap-4">
                        <VoiceIdCommander
                            isRecording={isRecording}
                            setIsRecording={setIsRecording}
                            onRecordingComplete={handleNewRecording}
                            disabled={isEnrolled || isProcessing}
                        />

                        {isProcessing && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <p>Processing your voiceprint...</p>
                            </div>
                        )}
                         <div className="text-sm text-muted-foreground">
                            Progress: {enrollmentCount} / {REQUIRED_ENROLLMENTS} enrollments completed.
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
