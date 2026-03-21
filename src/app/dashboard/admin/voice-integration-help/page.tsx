
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '@/components/admin/code-display';
import { voiceIntegrationCodeText } from './code-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Mic, Info, Code2 } from 'lucide-react';
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
            <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-black/5 pb-8">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            <Mic className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-black uppercase tracking-tighter italic">NLU Architecture</CardTitle>
                            <CardDescription className="font-bold opacity-40">
                                Technical overview of the Natural Language Understanding layer.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <Alert className="bg-amber-50 border-2 border-amber-100 rounded-2xl">
                        <Info className="h-5 w-5 text-amber-600" />
                        <AlertTitle className="text-amber-900 font-black uppercase text-xs">Feature Decommissioned</AlertTitle>
                        <AlertDescription className="text-amber-800 text-sm font-bold opacity-60">
                            The active voice engine has been replaced with lightweight stubs to focus the platform on standard marketplace operations.
                        </AlertDescription>
                    </Alert>

                   <Accordion type="single" collapsible className="w-full" defaultValue={voiceIntegrationCodeText[0]?.path}>
                        {voiceIntegrationCodeText.map((file) => (
                             <AccordionItem value={file.path} key={file.path} className="border-0 mb-4">
                                <AccordionTrigger className="rounded-xl border-2 px-4 hover:bg-muted/50 hover:no-underline font-mono text-xs font-bold text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <Code2 className="h-4 w-4 opacity-40" />
                                        {file.path}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4">
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
