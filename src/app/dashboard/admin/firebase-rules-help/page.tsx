
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '@/components/admin/code-display';
import { rulesText } from './rules-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';

export default function FirebaseRulesHelpPage() {
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
                        <Shield className="h-8 w-8 text-primary" />
                        Root Firestore Rules
                    </CardTitle>
                    <CardDescription>
                        This is the full content of your root `firestore.rules` file. Use this to debug permission errors.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <CodeDisplay codeText={rulesText} />
                </CardContent>
            </Card>
        </div>
    );
}
