
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { runNLU, extractQuantityAndProduct } from '@/lib/nlu/voice-integration';
import { Binary, Bot } from 'lucide-react';

export default function NumberEngineDemoPage() {
  const [phrase, setPhrase] = useState('add 1 and half kg onions');
  const [result, setResult] = useState<any>(null);

  const handleTest = () => {
    const nluResult = runNLU(phrase);
    const extracted = extractQuantityAndProduct(nluResult);
    setResult({ nluResult, extracted });
  };

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            NLU Engine Demo
          </CardTitle>
          <CardDescription>
            Test the Natural Language Understanding engine by typing a phrase below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="test-phrase" className="font-medium">Test Phrase</label>
            <div className="flex gap-2">
                <Input
                    id="test-phrase"
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                />
                <Button onClick={handleTest}>Test</Button>
            </div>
          </div>

          {result && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><Binary className="h-4 w-4"/> Full NLU Result</h3>
                <pre className="mt-2 p-4 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  {JSON.stringify(result.nluResult, null, 2)}
                </pre>
              </div>
               <div>
                <h3 className="font-semibold">Extracted Quantity & Product</h3>
                 <pre className="mt-2 p-4 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  {JSON.stringify(result.extracted, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
