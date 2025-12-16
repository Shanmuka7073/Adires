
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { useState } from 'react';

// Placeholder display component
function AuditDisplay({ auditText }: { auditText: string }) {
    return (
        <div className="space-y-4">
            <pre className="p-4 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm">
                <code>{auditText}</code>
            </pre>
        </div>
    );
}

export default function PerformanceAuditPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const [auditContent, setAuditContent] = useState("Waiting for the full audit report...");

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
                       <BarChart3 className="h-8 w-8 text-primary" />
                        Firebase Performance Audit
                    </CardTitle>
                    <CardDescription>
                        A detailed breakdown of Firestore read/write operations and potential performance bottlenecks.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <AuditDisplay auditText={auditContent} />
                </CardContent>
            </Card>
        </div>
    );
}
