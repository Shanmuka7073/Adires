'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

export default function SanityCheckPage() {

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>AI Sanity Check</CardTitle>
                    <CardDescription>
                        Use this page to verify that the server-side AI generation is working correctly.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Alert variant="destructive" className="mt-6">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Feature Disabled</AlertTitle>
                        <AlertDescription>
                            <p>The AI backend is currently disabled for development. This feature will be available once the server logic is re-enabled.</p>
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
}
