'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PitchDisplay } from './pitch-display';
import { pitchText } from './pitch-text'; // Store text in a separate file

// This is now a client component.
export default function PitchPage() {
    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline">App Pitch & Vision</CardTitle>
                    <CardDescription>
                        This is the comprehensive pitch for the LocalBasket application, outlining the problem, solution, and vision.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <PitchDisplay pitchText={pitchText} />
                </CardContent>
            </Card>
        </div>
    );
}
