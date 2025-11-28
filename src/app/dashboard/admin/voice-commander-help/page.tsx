
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '../fingerprint-help/code-display';
import { voiceCommanderCodeText } from './code-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Mic, Sparkles, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { refactorVoiceCommander, RefactorVoiceCommanderOutput } from '@/ai/flows/refactor-voice-commander-flow';

export default function VoiceCommanderHelpPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isSuggesting, startSuggestion] = useTransition();
    const [suggestion, setSuggestion] = useState<RefactorVoiceCommanderOutput | null>(null);

    const handleGetSuggestion = async () => {
        const commanderCode = voiceCommanderCodeText[0]?.content;
        if (!commanderCode) {
            toast({ variant: 'destructive', title: 'Source code not found.' });
            return;
        }

        startSuggestion(async () => {
            try {
                const result = await refactorVoiceCommander({ code: commanderCode });
                setSuggestion(result);
                toast({ title: 'AI Suggestions Ready!', description: 'The AI has provided a refactoring suggestion below.' });
            } catch (error) {
                console.error("AI Refactoring failed:", error);
                toast({ variant: 'destructive', title: 'AI Error', description: 'Could not get suggestions from the AI.' });
            }
        });
    };

    if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    if (isAdminLoading) {
        return <p>Loading...</p>
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2">
                       <Mic className="h-8 w-8 text-primary" />
                        Voice Commander Source Code
                    </CardTitle>
                    <CardDescription>
                        This is the complete source code for the main voice command processing logic in the application.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <Accordion type="single" collapsible className="w-full" defaultValue={voiceCommanderCodeText[0]?.path}>
                        {voiceCommanderCodeText.map((file) => (
                             <AccordionItem value={file.path} key={file.path}>
                                <AccordionTrigger className="font-mono text-sm">{file.path}</AccordionTrigger>
                                <AccordionContent>
                                    <CodeDisplay codeText={file.content} />
                                </AccordionContent>
                             </AccordionItem>
                        ))}
                   </Accordion>

                   <div className="mt-8 border-t pt-8">
                        <h3 className="text-2xl font-bold flex items-center gap-2 mb-4">
                            <Bot className="h-6 w-6 text-primary" />
                            AI Code Refactor & Suggestions
                        </h3>
                        <p className="text-muted-foreground mb-4">
                            Click the button below to have an AI analyze the Voice Commander code and suggest improvements for clarity, performance, and modularity.
                        </p>
                        <Button onClick={handleGetSuggestion} disabled={isSuggesting}>
                            {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Get AI Suggestions
                        </Button>

                        {suggestion && (
                            <div className="mt-6 space-y-6">
                                 <Card className="bg-primary/5 border-primary/20">
                                    <CardHeader>
                                        <CardTitle>Explanation of Changes</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm text-foreground">
                                        <p>{suggestion.explanation}</p>
                                    </CardContent>
                                 </Card>
                                  <Card>
                                    <CardHeader>
                                        <CardTitle>AI-Suggested Code</CardTitle>
                                        <CardDescription>This is the refactored code provided by the AI.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <CodeDisplay codeText={suggestion.refactoredCode} />
                                    </CardContent>
                                 </Card>
                            </div>
                        )}
                   </div>
                </CardContent>
            </Card>
        </div>
    );
}
