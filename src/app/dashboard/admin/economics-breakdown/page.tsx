
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import React from 'react';
import { economicsText } from './economics-text';
import { EconomicsDisplay } from './economics-display';


export default function EconomicsBreakdownPage() {
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
                       <TrendingUp className="h-8 w-8 text-primary" />
                        App Economics Breakdown
                    </CardTitle>
                    <CardDescription>
                        An explanation of how the app calculates unit, volume, and efficiency economics.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <EconomicsDisplay economicsText={economicsText} />
                </CardContent>
            </Card>
        </div>
    );
}
