
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, Terminal, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { sanityCheck } from '@/ai/flows/sanity-check-flow';
import { cn } from '@/lib/utils';

type CheckStatus = 'idle' | 'loading' | 'success' | 'error';

interface CheckResult {
    status: CheckStatus;
    message: string;
}

export default function SanityCheckPage() {
    const [result, setResult] = useState<CheckResult>({ status: 'idle', message: '' });
    const [isChecking, startCheckTransition] = useTransition();

    const handleRunCheck = () => {
        setResult({ status: 'loading', message: 'Running AI sanity check...' });
        startCheckTransition(async () => {
            try {
                const response = await sanityCheck("Is the AI system operational?");
                if (response && response.includes("operational")) {
                    setResult({ status: 'success', message: response });
                } else {
                    setResult({ status: 'error', message: `Unexpected AI response: ${response}` });
                }
            } catch (error) {
                console.error("Sanity check failed:", error);
                setResult({ status: 'error', message: (error as Error).message });
            }
        });
    };

    const getAlertVariant = (status: CheckStatus): 'default' | 'destructive' => {
        return status === 'success' ? 'default' : 'destructive';
    };

    const getIcon = (status: CheckStatus) => {
        switch (status) {
            case 'loading':
                return <Loader2 className="h-4 w-4 animate-spin" />;
            case 'success':
                return <CheckCircle className="h-4 w-4" />;
            case 'error':
                return <AlertTriangle className="h-4 w-4" />;
            default:
                return <Terminal className="h-4 w-4" />;
        }
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        AI Sanity Check
                    </CardTitle>
                    <CardDescription>
                        Use this page to verify that the server-side AI generation is working correctly.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleRunCheck} disabled={isChecking}>
                        {isChecking ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</>
                        ) : "Run AI Check"}
                    </Button>

                    {result.status !== 'idle' && (
                        <Alert variant={getAlertVariant(result.status)} className="mt-6">
                            {getIcon(result.status)}
                            <AlertTitle>
                                {result.status === 'success' && 'AI Check Successful!'}
                                {result.status === 'error' && 'AI Check Failed'}
                                {result.status === 'loading' && 'Running Check...'}
                            </AlertTitle>
                            <AlertDescription>
                                <p className="font-mono text-xs break-words">{result.message}</p>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
