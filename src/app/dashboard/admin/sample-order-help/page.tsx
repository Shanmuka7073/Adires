'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '@/components/admin/code-display';
import { sampleOrderCode } from './code-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';

/**
 * @fileOverview A dashboard page that displays a sample order document JSON.
 */
export default function SampleOrderHelpPage() {
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
                    <div className="flex items-center gap-3">
                        <Package className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle className="text-3xl font-headline">Sample Order Document</CardTitle>
                            <CardDescription>
                                This is a representative JSON structure of an order document stored in the Firestore `/orders` collection.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <CodeDisplay codeText={sampleOrderCode} />
                </CardContent>
            </Card>
        </div>
    );
}
