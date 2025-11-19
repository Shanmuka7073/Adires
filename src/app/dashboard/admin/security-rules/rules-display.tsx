
'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

export function RulesDisplay({ rulesText }: { rulesText: string }) {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(rulesText).then(() => {
            toast({
                title: "Rules Copied!",
                description: "The Firestore security rules have been copied to your clipboard.",
            });
        }, (err) => {
            toast({
                variant: 'destructive',
                title: "Copy Failed",
                description: "Could not copy the rules to your clipboard.",
            });
            console.error('Could not copy text: ', err);
        });
    };

    return (
        <div className="space-y-4">
            <Button onClick={handleCopy} className="w-full md:w-auto">
                <Copy className="mr-2 h-4 w-4" />
                Copy Rules to Clipboard
            </Button>
            <pre className="p-4 bg-muted text-muted-foreground rounded-md overflow-x-auto text-sm">
                <code>{rulesText}</code>
            </pre>
        </div>
    );
}
