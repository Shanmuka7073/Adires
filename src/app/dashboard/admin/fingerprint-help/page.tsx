
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from './code-display';
import { fingerprintCodeText } from './code-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Fingerprint } from 'lucide-react';

export default function FingerprintHelpPage() {
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
                       <Fingerprint className="h-8 w-8 text-primary" />
                        Fingerprint Login Source Code
                    </CardTitle>
                    <CardDescription>
                        This is the source code for the key files implementing WebAuthn (fingerprint) login.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <Accordion type="multiple" className="w-full space-y-4">
                        {fingerprintCodeText.map((file) => (
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
