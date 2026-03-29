
'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

/**
 * A shared component for displaying code snippets with a copy-to-clipboard button.
 */
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
            });
        });
    };

    return (
        <div className="space-y-4">
            <Button onClick={handleCopy} className="w-full md:w-auto" variant="outline" size="sm">
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
            </Button>
            <pre className="p-4 bg-muted text-muted-foreground rounded-md overflow-x-auto text-xs font-mono border">
                <code>{codeText}</code>
            </pre>
        </div>
    );
}
