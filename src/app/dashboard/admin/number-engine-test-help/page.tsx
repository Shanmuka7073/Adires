
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CodeDisplay } from '../fingerprint-help/code-display';
import { numberEngineTestCode } from './code-text';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TestTube, FileCode, CheckCircle, Rocket, Settings, BarChart2 } from 'lucide-react';

const instructions = [
    {
        title: "Create Folder Structure",
        icon: FileCode,
        content: "In your project root, ensure you have two folders: `/scripts` and `/tests`. The test runner script will reside in `/scripts`, and the test phrases will be in `/tests`."
    },
    {
        title: "Add Test Phrases File",
        icon: FileCode,
        content: "Create a file named `tests/test-phrases.json` and paste the full JSON list of English, Telugu, and Hindi phrases into it."
    },
    {
        title: "Install Tools",
        icon: Settings,
        content: "Open your terminal and run `npm install -D ts-node typescript @types/node` to install the necessary tools for running TypeScript scripts directly."
    },
    {
        title: "Run the Script",
        icon: Rocket,
        content: "In your terminal, execute the command: `npx ts-node scripts/run-number-tests.ts`. The script will then process all the phrases from your JSON file."
    },
    {
        title: "View Your Results",
        icon: BarChart2,
        content: "After the script finishes, a new file named `number-engine-test-results.csv` will appear in your project root. You can open this file in Excel, Google Sheets, or any text editor to see the results."
    },
    {
        title: "Improve the Engine",
        icon: CheckCircle,
        content: "Review the CSV file for any rows where the 'parsed' column is `false`. Send me these failed rows, and I will generate the rule patches to fix them, which you can add to `rules/custom-rules.json` or `rules/learned-rules.json`."
    }
];

export default function NumberEngineTestHelpPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();

     if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    if (isAdminLoading) {
        return <p>Loading...</p>
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline flex items-center gap-2">
                       <TestTube className="h-8 w-8 text-primary" />
                        Number Engine Test Runner
                    </CardTitle>
                    <CardDescription>
                        A complete guide to using the automated test script for the Number Meaning Engine. This runs locally and does not require a server.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div>
                        <h3 className="text-xl font-semibold mb-4">How to Run the Test</h3>
                        <div className="space-y-4">
                            {instructions.map((step, index) => (
                                <div key={index} className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                        <step.icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">{`Step ${index + 1}: ${step.title}`}</h4>
                                        <p className="text-sm text-muted-foreground">{step.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="source-code">
                            <AccordionTrigger className="text-lg font-semibold">View Script Source Code</AccordionTrigger>
                            <AccordionContent>
                                <CodeDisplay codeText={numberEngineTestCode[0].content} />
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}
