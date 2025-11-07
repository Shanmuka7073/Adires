
import { promises as fs } from 'fs';
import path from 'path';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PitchDisplay } from './pitch-display';

async function getPitchContent(): Promise<string> {
    const filePath = path.join(process.cwd(), 'docs', 'pitch.md');
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return fileContent;
    } catch (error) {
        console.error("Error reading pitch file:", error);
        return "Could not load the pitch content. Please check the server logs.";
    }
}

export default async function PitchPage() {
    const pitchContent = await getPitchContent();

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline">App Pitch</CardTitle>
                    <CardDescription>
                        This is the comprehensive pitch for the LocalBasket application. Use the button to share it.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <PitchDisplay pitchText={pitchContent} />
                </CardContent>
            </Card>
        </div>
    );
}
