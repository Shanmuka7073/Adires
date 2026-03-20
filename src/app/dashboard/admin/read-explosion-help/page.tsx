'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '@/components/admin/code-display';
import { readExplosionCodeText } from './code-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ZapOff, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ReadExplosionHelpPage() {
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
                       <TrendingUp className="h-8 w-8 text-destructive" />
                        Read Explosion Analysis
                    </CardTitle>
                    <CardDescription>
                        Identifying the exact line of code responsible for the "N+3" Firestore read amplification on startup.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Performance Warning</AlertTitle>
                        <AlertDescription>
                            The loop identified below scales linearly with the number of stores. As your platform grows, this will become the single largest contributor to your monthly Firestore bill.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                            <ZapOff className="h-5 w-5 text-muted-foreground" />
                            Source of Amplification
                        </h3>
                        <CodeDisplay codeText={readExplosionCodeText} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
