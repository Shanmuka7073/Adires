
'use client';

import { useState, useTransition, useEffect, useRef, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Bot, User, Loader2, Send, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ashaChat } from '@/ai/flows/asha-chat-flow';
import type { ChatMessage } from '@/lib/types';

export default function AshaAgentPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, startThinkingTransition] = useTransition();
    const { toast } = useToast();
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isThinking) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        startThinkingTransition(async () => {
            try {
                const response = await ashaChat(input, messages);
                const modelMessage: ChatMessage = { role: 'model', text: response };
                setMessages(prev => [...prev, modelMessage]);
            } catch (error) {
                console.error("Asha chat error:", error);
                toast({
                    variant: 'destructive',
                    title: 'AI Error',
                    description: 'Could not get a response from Asha.',
                });
                // Optionally remove the user's message if the call fails
                setMessages(prev => prev.slice(0, -1));
            }
        });
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 flex justify-center">
            <Card className="w-full max-w-3xl flex flex-col h-[80vh]">
                <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-3">
                        <Bot className="h-8 w-8 text-primary" />
                        <span>Asha: AI Diagnostic Agent</span>
                    </CardTitle>
                    <CardDescription>
                        A conversational AI to help diagnose and troubleshoot application issues. Try asking "What was the last error?"
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea ref={scrollAreaRef} className="h-full p-6">
                        <div className="space-y-6">
                            {messages.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Sparkles className="mx-auto h-10 w-10 mb-2" />
                                    <p>Start a conversation with Asha.</p>
                                </div>
                            ) : (
                                messages.map((message, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "flex items-start gap-3",
                                            message.role === 'user' ? 'justify-end' : 'justify-start'
                                        )}
                                    >
                                        {message.role === 'model' && <Bot className="h-6 w-6 text-primary flex-shrink-0" />}
                                        <div className={cn(
                                            "p-3 rounded-lg max-w-[80%]",
                                            message.role === 'user' ? 'bg-primary/10' : 'bg-muted/80'
                                        )}>
                                            <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                                        </div>
                                        {message.role === 'user' && <User className="h-6 w-6 text-muted-foreground flex-shrink-0" />}
                                    </div>
                                ))
                            )}
                            {isThinking && (
                                <div className="flex items-start gap-3 justify-start">
                                    <Bot className="h-6 w-6 text-primary flex-shrink-0" />
                                    <div className="p-3 rounded-lg bg-muted/80">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
                <CardFooter className="p-4 border-t">
                    <form onSubmit={handleSubmit} className="w-full flex items-center gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Asha a question..."
                            disabled={isThinking}
                        />
                        <Button type="submit" disabled={!input.trim() || isThinking}>
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    );
}
