
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OverviewDisplay } from './overview-display';
import { overviewText } from './overview-text';

export default function AppOverviewPage() {
    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline">App Overview</CardTitle>
                    <CardDescription>
                        A complete breakdown of the app's features, architecture, and core components.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <OverviewDisplay overviewText={overviewText} />
                </CardContent>
            </Card>
        </div>
    );
}
