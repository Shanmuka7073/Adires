
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseSentenceForNumbers, ParsedResult } from '@/lib/number-meaning-engine';
import { safeEvaluate } from '@/lib/math-solver';
import { Binary, Send } from 'lucide-react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';

export default function NumberEngineDemoPage() {
    const [text, setText] = useState('what is the price of 2 kg potatoes plus 5% tax');
    const [result, setResult] = useState<ParsedResult | null>(null);
    const { isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    
    if (!isLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    const handleParse = () => {
        let parsed = parseSentenceForNumbers(text);
        if (parsed.mathExpression) {
            const mathResult = safeEvaluate(parsed.mathExpression);
            parsed = { ...parsed, mathResult };
        }
        setResult(parsed);
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-3xl font-headline">
                        <Binary className="h-8 w-8 text-primary" />
                        Number Meaning Engine Demo
                    </CardTitle>
                    <CardDescription>
                        Test how the deterministic NLU engine parses sentences to understand quantities, units, math, and more.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="sentence-input" className="font-semibold">Enter a Sentence</Label>
                        <div className="flex gap-2">
                            <Input
                                id="sentence-input"
                                placeholder="e.g., add two kilos of apples"
                                value={text}
                                onChange={e => setText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleParse()}
                            />
                            <Button onClick={handleParse}><Send className="mr-2 h-4 w-4" /> Parse</Button>
                        </div>
                    </div>

                    {result && (
                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="font-semibold text-lg">Parser Output</h3>
                            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                                <code>
                                    {JSON.stringify(result, null, 2)}
                                </code>
                            </pre>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
