
import { promises as fs } from 'fs';
import path from 'path';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeBlock } from './code-block';

async function getFileContent(filePath: string): Promise<string> {
    const fullPath = path.join(process.cwd(), filePath);
    try {
        return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return `Could not load file: ${filePath}. Please check server logs.`;
    }
}

export default async function DebugGenaiPage() {
    const genkitConfig = await getFileContent('src/ai/genkit.ts');
    const actionsContent = await getFileContent('src/app/actions.ts');
    const flowContent = await getFileContent('src/ai/flows/general-question-flow.ts');

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-8">
            <div className="text-center">
                 <h1 className="text-4xl font-bold font-headline">Gemini API Debug View</h1>
                <p className="text-lg text-muted-foreground mt-2">
                    Here is the current code for configuring and calling the Gemini API via Genkit.
                </p>
            </div>
           
            <CodeBlock 
                title="Genkit Configuration"
                description="This file initializes Genkit and the Google AI plugin. Check here for API version and core settings."
                filePath="src/ai/genkit.ts"
                code={genkitConfig}
            />

            <CodeBlock 
                title="Server Actions"
                description="This file wraps the Genkit flows and includes retry logic. Failures here might indicate issues with the server action itself or how it calls the flow."
                filePath="src/app/actions.ts"
                code={actionsContent}
            />

            <CodeBlock 
                title="Example AI Flow"
                description="This is an example of a specific flow that calls the Gemini model. Check the prompt, model name, and schema definitions here."
                filePath="src/ai/flows/general-question-flow.ts"
                code={flowContent}
            />
        </div>
    );
}
