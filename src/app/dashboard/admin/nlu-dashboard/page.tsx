
'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { PDFUploadPanel } from './pdf-upload-panel';
import { RuleReviewPanel } from './rule-review-panel';
import { ApprovedRulesPanel } from './approved-rules-panel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUp, ListChecks, CheckCircle, Cog } from 'lucide-react';
import { NLUDashboardProvider } from './nlu-dashboard-context';

export default function NluDashboardPage() {
    const { isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    
    if (isLoading) {
        return <div className="container mx-auto py-12">Loading...</div>;
    }
    
    if (!isAdmin) {
        router.replace('/dashboard');
        return <div className="container mx-auto py-12">Redirecting...</div>;
    }

    return (
        <NLUDashboardProvider>
            <div className="container mx-auto py-12 px-4 md:px-6">
                 <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Cog className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle className="text-3xl font-headline">NLU Training Dashboard</CardTitle>
                                <CardDescription>
                                    Improve the voice engine's understanding by uploading documents and approving new grammar rules.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="upload">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="upload"><FileUp className="mr-2 h-4 w-4" />Upload & Process</TabsTrigger>
                                <TabsTrigger value="review"><ListChecks className="mr-2 h-4 w-4" />Review Pending Rules</TabsTrigger>
                                <TabsTrigger value="approved"><CheckCircle className="mr-2 h-4 w-4" />View Approved Rules</TabsTrigger>
                            </TabsList>
                            <TabsContent value="upload" className="mt-6">
                                <PDFUploadPanel />
                            </TabsContent>
                            <TabsContent value="review" className="mt-6">
                                <RuleReviewPanel />
                            </TabsContent>
                            <TabsContent value="approved" className="mt-6">
                                <ApprovedRulesPanel />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </NLUDashboardProvider>
    );
}
