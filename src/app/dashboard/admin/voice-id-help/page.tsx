
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '../fingerprint-help/code-display'; // Reusing the display component
import { voiceIdCodeText } from './code-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Voicemail } from 'lucide-react';

export default function VoiceIdHelpPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();

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
                       <Voicemail className="h-8 w-8 text-primary" />
                        Voice ID Source Code
                    </CardTitle>
                    <CardDescription>
                        This is the source code for the key files implementing the non-AI voiceprint verification system.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <Accordion type="multiple" className="w-full space-y-4">
                        {voiceIdCodeText.map((file) => (
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
