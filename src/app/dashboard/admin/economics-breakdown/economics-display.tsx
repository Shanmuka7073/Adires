
'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function EconomicsDisplay({ economicsText }: { economicsText: string }) {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(economicsText).then(() => {
            toast({
                title: "Report Copied!",
                description: "The economics breakdown has been copied to your clipboard.",
            });
        }).catch(err => {
            toast({
                variant: 'destructive',
                title: "Copy Failed",
                description: "Could not copy the report.",
            });
        });
    };

    const formatContent = (text: string) => {
        return text
            .split('\n')
            .map((line, index) => {
                if (line.startsWith('### ')) {
                    return <h3 key={index} className="text-xl font-semibold mt-6 mb-2">{line.substring(4)}</h3>;
                }
                if (line.startsWith('## ')) {
                    return <h2 key={index} className="text-2xl font-bold mt-8 mb-4 border-b pb-2">{line.substring(3)}</h2>;
                }
                 if (line.startsWith('*   **')) {
                    const boldPart = line.match(/\*\*(.*?)\*\*/);
                    const restOfLine = line.substring(boldPart ? boldPart[0].length + 4 : 2);
                    return <p key={index} className="mt-2"><strong className="font-semibold">{boldPart ? boldPart[1] : ''}:</strong>{restOfLine}</p>;
                }
                 if (line.startsWith('*   ')) {
                    return <li key={index} className="ml-8 list-disc">{line.substring(4)}</li>;
                }
                 if (line.trim() === '') {
                    return <br key={index} />;
                }
                return <p key={index}>{line}</p>;
            })
    };

    return (
        <div className="space-y-4">
             <Button onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Explanation
            </Button>
            <div className="prose prose-sm sm:prose-base max-w-none">
                {formatContent(economicsText)}
            </div>
        </div>
    );
}

export { EconomicsDisplay };
