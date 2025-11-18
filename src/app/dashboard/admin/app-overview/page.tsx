
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OverviewDisplay } from './overview-display';
import { overviewText } from './overview-text';

// This is a client component to allow for the share functionality.
export default function AppOverviewPage() {
    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline">Application Overview</CardTitle>
                    <CardDescription>
                        A complete breakdown of the LocalBasket app, its features, design, and technical architecture.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <OverviewDisplay overviewText={overviewText} />
                </CardContent>
            </Card>
        </div>
    );
}
