'use client';

import { useState, useTransition } from 'react';
import { sanityCheckFlow } from '@/ai/flows/sanity-check-flow';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Sparkles, Loader2 } from 'lucide-react';

export default function SanityCheckPage() {
    const [isPending, startTransition] = useTransition();
    const [prompt, setPrompt] = useState('Hello, AI!');
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setResult(null);
        setError(null);
        startTransition(async () => {
            try {
                const res = await sanityCheckFlow(prompt);
                if (res.startsWith('Error')) {
                    setError(res);
                } else {
                    setResult(res);
                }
            } catch (err: any) {
                setError(err.message || 'An unexpected error occurred.');
            }
        });
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
                        Enter a message and the AI should respond.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input 
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Enter a message for the AI"
                            disabled={isPending}
                        />
                        <Button type="submit" disabled={isPending} className="w-full">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send to AI
                        </Button>
                    </form>

                    {result && (
                        <Alert className="mt-6">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>AI Response:</AlertTitle>
                            <AlertDescription>
                                <p className="font-mono">{result}</p>
                            </AlertDescription>
                        </Alert>
                    )}
                    
                    {error && (
                        <Alert variant="destructive" className="mt-6">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>Error:</AlertTitle>
                            <AlertDescription>
                                <p className="font-mono">{error}</p>
                            </AlertDescription>
                        </Alert>
                    )}

                </CardContent>
            </Card>
        </div>
    );
}
