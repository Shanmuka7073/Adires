
'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

export function CodeDisplay({ codeText }: { codeText: string }) {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(codeText).then(() => {
            toast({
                title: "Code Copied!",
                description: "The source code has been copied to your clipboard.",
            });
        }, (err) => {
            toast({
                variant: 'destructive',
                title: "Copy Failed",
                description: "Could not copy the code to your clipboard.",
            });
            console.error('Could not copy text: ', err);
        });
    };

    return (
        <div className="space-y-4">
            <Button onClick={handleCopy} size="sm">
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
            </Button>
            <pre className="p-4 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm">
                <code>{codeText}</code>
            </pre>
        </div>
    );
}
