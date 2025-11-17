'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileWarning } from 'lucide-react';


export default function SuggestionsPage() {

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <CardTitle>AI-Powered Suggestions</CardTitle>
                    <CardDescription>
                        Review voice commands that the system failed to understand.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
    )
}
