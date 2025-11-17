
'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Send, Loader2 } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types';
import { ashaChatFlow } from '@/ai/flows/asha-chat-flow';

function ChatBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';
    return (
        <div className={`flex items-start gap-4 ${isUser ? 'justify-end' : ''}`}>
            {!isUser && <div className="p-2 bg-primary/10 rounded-full"><Bot className="h-6 w-6 text-primary" /></div>}
            <div className={`max-w-xs md:max-w-md rounded-xl p-4 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="text-sm">{message.text}</p>
            </div>
            {isUser && <div className="p-2 bg-muted rounded-full"><User className="h-6 w-6 text-muted-foreground" /></div>}
        </div>
    );
}

export default function AshaAgentPage() {
    const [input, setInput] = useState('');
    const [isPending, startTransition] = useTransition();
    const { firestore, user } = useFirebase();
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const chatQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `asha-conversations/${user.uid}/conversation`), orderBy('timestamp'));
    }, [firestore, user]);

    const { data: messages, isLoading } = useCollection<ChatMessage>(chatQuery);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const userMessage = input.trim();
        if (!userMessage || isPending || !firestore || !user) return;

        setInput('');

        const conversationRef = collection(firestore, `asha-conversations/${user.uid}/conversation`);
        const history: ChatMessage[] = messages || [];

        // Add user message to Firestore optimistically
        await addDoc(conversationRef, { role: 'user', text: userMessage, timestamp: serverTimestamp() });
        
        startTransition(async () => {
            try {
                // Call the AI flow with the current history and new message
                const modelResponse = await ashaChatFlow({
                    history: history,
                    message: userMessage,
                });
                // Add model's response to Firestore
                await addDoc(conversationRef, { role: 'model', text: modelResponse, timestamp: serverTimestamp() });
            } catch (error) {
                console.error("AI chat flow failed:", error);
                // Add an error message to the chat
                 await addDoc(conversationRef, { role: 'model', text: "Sorry, I encountered an error. Please try again.", timestamp: serverTimestamp() });
            }
        });
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 flex justify-center">
            <Card className="w-full max-w-3xl h-[80vh] flex flex-col">
                <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-3">
                        <Bot className="h-8 w-8 text-primary" />
                        <span>Asha: AI Diagnostic Agent</span>
                    </CardTitle>
                    <CardDescription>
                        Ask me about application errors, system status, or how features work.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea className="h-full p-6" ref={scrollAreaRef}>
                        <div className="space-y-6">
                            {isLoading && <p>Loading conversation...</p>}
                            {messages?.map((msg, index) => (
                                <ChatBubble key={index} message={msg} />
                            ))}
                            {isPending && (
                                <div className="flex items-start gap-4">
                                     <div className="p-2 bg-primary/10 rounded-full"><Bot className="h-6 w-6 text-primary" /></div>
                                     <div className="max-w-xs md:max-w-md rounded-xl p-4 bg-muted flex items-center">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
                <div className="border-t p-4">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Asha a question..."
                            disabled={isPending}
                        />
                        <Button type="submit" size="icon" disabled={!input.trim() || isPending}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </Card>
        </div>
    );
}
