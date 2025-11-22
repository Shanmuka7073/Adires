
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ManifestDisplay } from './manifest-display';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { BookCopy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getManifest } from '@/app/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ManifestHelpPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const [manifestText, setManifestText] = useState('Loading manifest...');

    useEffect(() => {
        async function loadManifest() {
            try {
                const manifestData = await getManifest();
                if (manifestData) {
                    setManifestText(JSON.stringify(manifestData, null, 2));
                } else {
                    setManifestText('Could not load manifest.json. The file may be missing or invalid.');
                }
            } catch (error) {
                setManifestText('Error loading manifest file.');
            }
        }
        loadManifest();
    }, []);

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
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-3xl font-headline flex items-center gap-2">
                           <BookCopy className="h-8 w-8 text-primary" />
                            PWA Manifest
                        </CardTitle>
                         <Button asChild variant="outline">
                            <Link href="/dashboard/admin/pwa-settings">
                                Edit Manifest
                            </Link>
                        </Button>
                    </div>
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
