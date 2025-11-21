'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '../fingerprint-help/code-display';
import { checkoutLoopCodeText } from './code-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Bug } from 'lucide-react';

export default function CheckoutLoopHelpPage() {
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
                       <Bug className="h-8 w-8 text-destructive" />
                        Checkout Loop Debug Snippet
                    </CardTitle>
                    <CardDescription>
                        This is the specific section of the Voice Commander related to the checkout page's address-type query loop.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CodeDisplay codeText={checkoutLoopCodeText} />
                </CardContent>
            </Card>
        </div>
    );
}
