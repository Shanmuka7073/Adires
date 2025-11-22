
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ManifestDisplay } from './manifest-display';
import { manifestText } from './manifest-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { BookCopy } from 'lucide-react';

export default function ManifestHelpPage() {
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
                       <BookCopy className="h-8 w-8 text-primary" />
                        PWA Manifest
                    </CardTitle>
                    <CardDescription>
                        This is the live content of your `public/manifest.json` file. Use this to view, copy, and share the PWA configuration.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <ManifestDisplay manifestText={manifestText} />
                </CardContent>
            </Card>
        </div>
    );
}

    