'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, FileWarning } from 'lucide-react';


export default function AshaAgentPage() {
    return (
        <div className="container mx-auto py-12 px-4 md:px-6 flex justify-center">
            <Card className="w-full max-w-3xl">
                <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-3">
                        <Bot className="h-8 w-8 text-primary" />
                        <span>Asha: AI Diagnostic Agent</span>
                    </CardTitle>
                    <CardDescription>
                        A conversational AI to help diagnose and troubleshoot application issues.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="text-center py-12">
                        <FileWarning className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-lg font-semibold">Feature Disabled</p>
                        <p className="text-muted-foreground mt-2">
                           The AI backend is currently disabled for development. This feature can be re-enabled later.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
