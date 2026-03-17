
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Copy, ShieldCheck, Sparkles, Code2 } from 'lucide-react';
import { generateSupportPrompt } from './prompt-content';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';

export default function SupportPromptPage() {
    const { isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [promptText] = useState(generateSupportPrompt());

    const handleCopy = () => {
        navigator.clipboard.writeText(promptText).then(() => {
            toast({ title: "Prompt Copied!", description: "Paste this into your chat with an AI assistant." });
        });
    };

    if (isLoading) return <div className="p-8 text-center">Loading context...</div>;
    if (!isAdmin) { router.replace('/dashboard'); return null; }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
                        <Sparkles className="h-10 w-10 text-primary" />
                    </div>
                    <h1 className="text-4xl font-black font-headline tracking-tight">AI Support Context</h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Consolidated "System Blueprint" for debugging and feature requests.</p>
                </div>

                <Card className="border-2 border-primary/20 shadow-2xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10 pb-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <CardTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                                <MessageSquare className="h-6 w-6 text-primary" /> System Context Package
                            </CardTitle>
                            <Button onClick={handleCopy} size="lg" className="rounded-2xl h-14 px-8 font-black uppercase tracking-widest shadow-xl">
                                <Copy className="mr-2 h-5 w-5" /> Copy Full Prompt
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[500px] w-full bg-slate-950">
                            <pre className="p-8 text-[11px] font-mono text-slate-300 leading-relaxed">
                                <code>{promptText}</code>
                            </pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
