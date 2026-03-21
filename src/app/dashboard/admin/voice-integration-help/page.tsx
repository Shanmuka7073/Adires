'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '@/components/admin/code-display';
import { voiceIntegrationCodeText } from './code-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Mic, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * @fileOverview Technical documentation for the voice integration layer.
 * Note: Voice features have been decommissioned, and this page now shows the stubbed logic.
 */
export default function VoiceIntegrationHelpPage() {
    const { isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();

    if (!isLoading && !isAdmin) {
        router.replace('/dashboard');
        return null;
    }

    if (isLoading) {
        return <div className="p-12 text-center">Loading documentation...</div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-4xl space-y-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Mic className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle className="text-3xl font-headline">Voice Integration Source</CardTitle>
                            <CardDescription>
                                Technical overview of the NLU (Natural Language Understanding) stub layer.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Alert className="bg-amber-50 border-amber-200">
                        <Info className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-900 font-bold">Feature Decommissioned</AlertTitle>
                        <AlertDescription className="text-amber-800">
                            The voice engine has been replaced with lightweight stubs to focus the platform on touch-based marketplace operations.
                        </AlertDescription>
                    </Alert>

                   <Accordion type="single" collapsible className="w-full" defaultValue={voiceIntegrationCodeText[0]?.path}>
                        {voiceIntegrationCodeText.map((file) => (
                             <AccordionItem value={file.path} key={file.path}>
                                <AccordionTrigger className="font-mono text-sm">{file.path}</AccordionTrigger>
                                <AccordionContent>
                                    <CodeDisplay codeText={file.content} />
                                </AccordionContent>
                             </AccordionItem>
                        ))}
                   </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}
