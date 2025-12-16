
'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


function AuditDisplay({ auditText }: { auditText: string }) {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(auditText).then(() => {
            toast({
                title: "Audit Report Copied!",
                description: "The full performance audit has been copied to your clipboard.",
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
                 if (line.startsWith('- **')) {
                    const boldPart = line.match(/- \*\*(.*?)\*\*/);
                    const restOfLine = line.substring(boldPart ? boldPart[0].length : 2);
                    return <p key={index} className="mt-2"><strong className="font-semibold">{boldPart ? boldPart[1] : ''}</strong>{restOfLine}</p>;
                }
                 if (line.startsWith('- ')) {
                    return <li key={index} className="ml-4 list-disc">{line.substring(2)}</li>;
                }
                if (line.trim() === '---') {
                    return <hr key={index} className="my-6 border-dashed" />;
                }
                if (line.startsWith('|')) {
                     const isHeader = line.includes('---');
                    const cells = line.split('|').map(c => c.trim()).slice(1, -1);
                     if (isHeader) return null;
                    return (
                        <tr key={index} className="border-b">
                            {cells.map((cell, i) => <td key={i} className="p-2 align-top">{cell}</td>)}
                        </tr>
                    );
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
                Copy Full Report
            </Button>
            <div className="prose prose-sm sm:prose-base max-w-none">
                {formatContent(auditText)}
            </div>
        </div>
    );
}

export { AuditDisplay };
