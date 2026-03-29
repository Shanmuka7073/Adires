
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '@/components/admin/code-display';
import { rulesText } from './rules-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Shield, MessageSquare, Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function SecurityRulesPage() {
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
            <div className="max-w-4xl mx-auto space-y-8">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Shield className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle className="text-3xl font-headline text-primary">Production Security Rules</CardTitle>
                                <CardDescription>
                                    These are the active rules protecting your Firestore database.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                       <CodeDisplay codeText={rulesText} />
                    </CardContent>
                </Card>

                <Alert className="bg-primary/5 border-primary/20">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <AlertTitle className="text-lg font-bold text-primary">Seeking Help Debugging?</AlertTitle>
                    <AlertDescription className="space-y-4 mt-2">
                        <p className="text-base">If you are encountering <strong>"Missing or insufficient permissions"</strong> errors, follow these steps to get help:</p>
                        <div className="bg-background/50 p-4 rounded-md border text-sm space-y-3">
                            <p><strong>1. Copy these rules</strong> using the button above.</p>
                            <p><strong>2. Note the context:</strong></p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>The <strong>Firestore Path</strong> (e.g., <code>/orders/123</code>)</li>
                                <li>The <strong>Method</strong> (e.g., <code>update</code> or <code>list</code>)</li>
                                <li>The <strong>User Role</strong> (Owner, Employee, or Guest)</li>
                            </ul>
                            <p><strong>3. Share with AI:</strong> Paste the rules and context to your AI partner. They can analyze the logic and generate a fix for you.</p>
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        </div>
    );
}
