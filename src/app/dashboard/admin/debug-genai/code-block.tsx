
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CodeBlockProps {
    title: string;
    description: string;
    filePath: string;
    code: string;
}

export function CodeBlock({ title, description, filePath, code }: CodeBlockProps) {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        toast({
            title: 'Copied to Clipboard!',
            description: `${filePath} has been copied.`,
        });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription className="mt-1 font-mono text-xs">{filePath}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleCopy}>
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Copy code</span>
                    </Button>
                </div>
                 <p className="text-sm text-muted-foreground pt-2">{description}</p>
            </CardHeader>
            <CardContent>
                <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                    <code>{code}</code>
                </pre>
            </CardContent>
        </Card>
    );
}
