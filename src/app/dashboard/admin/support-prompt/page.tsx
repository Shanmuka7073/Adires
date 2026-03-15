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

/**
 * @fileOverview A specialized admin page that generates a comprehensive
 * context prompt for use with AI coding assistants.
 */
export default function SupportPromptPage() {
    const { isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [promptText] = useState(generateSupportPrompt());

    const handleCopy = () => {
        navigator.clipboard.writeText(promptText).then(() => {
            toast({
                title: "Prompt Copied!",
                description: "You can now paste this into your conversation with the AI assistant.",
            });
        }).catch(err => {
            toast({
                variant: 'destructive',
                title: "Copy Failed",
                description: "Please select and copy the text manually.",
            });
        });
    };

    if (isLoading) return <div className="p-8 text-center">Loading context...</div>;
    if (!isAdmin) {
        router.replace('/dashboard');
        return null;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
                        <Sparkles className="h-10 w-10 text-primary" />
                    </div>
                    <h1 className="text-4xl font-black font-headline tracking-tight">AI Support Context</h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Seeking help from an AI assistant? Use the prompt below to provide the complete architecture, data schema, and security rules of your application in one go.
                    </p>
                </div>

                <Card className="border-2 border-primary/20 shadow-2xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10 pb-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="space-y-1">
                                <CardTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                                    <MessageSquare className="h-6 w-6 text-primary" />
                                    System Context Package
                                </CardTitle>
                                <CardDescription className="font-bold">Includes Rules, Schema, Architecture, and Performance Data.</CardDescription>
                            </div>
                            <Button onClick={handleCopy} size="lg" className="rounded-2xl h-14 px-8 font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95">
                                <Copy className="mr-2 h-5 w-5" />
                                Copy Full Prompt
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
                    <CardFooter className="bg-slate-900 border-t border-white/5 p-6 flex items-center gap-4">
                        <div className="flex -space-x-2">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center ring-2 ring-slate-900"><ShieldCheck className="h-4 w-4 text-white" /></div>
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-slate-900"><Code2 className="h-4 w-4 text-white" /></div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            This prompt provides secure, high-quality context for rapid debugging.
                        </p>
                    </CardFooter>
                </Card>

                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="bg-muted/50 border-0 rounded-3xl p-6">
                        <h3 className="font-black uppercase text-xs tracking-widest mb-3 opacity-40">How to use</h3>
                        <ol className="text-sm space-y-2 font-bold text-muted-foreground list-decimal pl-4">
                            <li>Click the "Copy Full Prompt" button above.</li>
                            <li>Navigate to your conversation with the AI.</li>
                            <li>Paste the context at the beginning of your request.</li>
                            <li>Add your specific question at the very bottom.</li>
                        </ol>
                    </Card>
                    <Card className="bg-primary/5 border-0 rounded-3xl p-6">
                        <h3 className="font-black uppercase text-xs tracking-widest mb-3 text-primary opacity-60">Pro Tip</h3>
                        <p className="text-sm font-bold text-primary/80">
                            By including your Security Rules and Audit data, the AI can pinpoint "Insufficient Permission" or "Read Explosion" errors without needing to ask follow-up questions.
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
