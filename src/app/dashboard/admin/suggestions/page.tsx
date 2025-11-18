
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot } from 'lucide-react';


export default function SuggestionsPage() {

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
       <Card>
        <CardHeader>
            <div className="flex items-center gap-3">
                <Bot className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-3xl font-headline">AI-Powered Suggestions</CardTitle>
                    <CardDescription>This feature is currently disabled.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="text-center py-16">
                <p className="text-lg font-semibold">The AI suggestion engine is not running.</p>
                <p className="text-muted-foreground mt-2">All AI functionality has been removed from this application.</p>
            </div>
        </CardContent>
       </Card>
    </div>
  );
}
