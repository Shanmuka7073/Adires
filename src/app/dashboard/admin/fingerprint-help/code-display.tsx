
'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

export function CodeDisplay({ codeText }: { codeText: string }) {
    const { toast } = useToast();

    const handleCopy = () => {
        // Modern browsers with secure context (HTTPS)
        if (navigator.clipboard) {
            navigator.clipboard.writeText(codeText).then(() => {
                toast({
                    title: "Code Copied!",
                    description: "The source code has been copied to your clipboard.",
                });
            }).catch(err => {
                // If modern API fails, try the fallback
                fallbackCopy(codeText);
            });
        } else {
            // Fallback for older browsers or insecure contexts (HTTP)
            fallbackCopy(codeText);
        }
    };

    const fallbackCopy = (text: string) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                 toast({
                    title: "Code Copied!",
                    description: "The source code has been copied to your clipboard.",
                });
            } else {
                 throw new Error('Fallback copy failed');
            }
        } catch (err) {
            toast({
                variant: 'destructive',
                title: "Copy Failed",
                description: "Could not copy the code to your clipboard.",
            });
            console.error('Could not copy text: ', err);
        }

        document.body.removeChild(textArea);
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
