
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ManifestDisplay } from './manifest-display';
import { getManifest } from '@/app/actions';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { FileCode } from 'lucide-react';


export default function ManifestHelpPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    // Specify 'any' to allow the manifest object to be stored in state
    const [manifest, setManifest] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [isAdmin, isAdminLoading, router]);

    useEffect(() => {
        async function fetchManifest() {
            setIsLoading(true);
            try {
                const manifestData = await getManifest();
                setManifest(manifestData);
            } catch (error) {
                console.error("Failed to fetch manifest:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchManifest();
    }, []);

    if (isAdminLoading) {
        return <p>Loading...</p>
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2">
                        <FileCode className="h-8 w-8 text-primary" />
                        PWA Manifest Editor
                    </CardTitle>
                    <CardDescription>
                        View and edit the content of your `public/manifest.json` file. This controls how your app appears when installed on a device.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-96 w-full" /> : <ManifestDisplay initialManifest={manifest} />}
                </CardContent>
            </Card>
        </div>
    );
}
