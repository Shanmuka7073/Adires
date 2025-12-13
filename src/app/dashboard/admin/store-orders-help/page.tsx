
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '../fingerprint-help/code-display';
import { storeOrdersCodeText } from './code-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Store } from 'lucide-react';

export default function StoreOrdersHelpPage() {
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
                       <Store className="h-8 w-8 text-primary" />
                        "Store Orders" Page Source Code
                    </CardTitle>
                    <CardDescription>
                        This is the source code for the store owner's order management dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <Accordion type="single" collapsible className="w-full">
                        {storeOrdersCodeText.map((file) => (
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

    