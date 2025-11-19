'use client';

import { useState, useTransition, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Send, User, Bot, Loader2, Sparkles, BrainCircuit } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types';
import { chatWithAsha } from '@/ai/flows/asha-flow';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';

function ChatBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';
    return (
        <div className={cn("flex items-start gap-4", isUser ? "justify-end" : "justify-start")}>
             {!isUser && (
                <Avatar className="h-8 w-8">
                    <AvatarFallback><Bot /></AvatarFallback>
                </Avatar>
            )}
            <div className={cn(
                "max-w-xs md:max-w-md lg:max-w-lg rounded-xl p-3 text-sm",
                isUser ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
                <p>{message.text}</p>
            </div>
            {isUser && (
                 <Avatar className="h-8 w-8">
                    <AvatarFallback><User /></AvatarFallback>
                </Avatar>
            )}
        </div>
    )
}


export default function AshaAgentPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [isThinking, startThinking] = useTransition();
    const [currentMessage, setCurrentMessage] = useState('');
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const conversationQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        // All admins will share the same conversation for simplicity. A real app would use a unique ID.
        return query(collection(firestore, 'asha-conversations', 'admin_chat', 'conversation'), orderBy('timestamp'));
    }, [firestore, user]);

    const { data: conversation, isLoading: isHistoryLoading } = useCollection<ChatMessage>(conversationQuery);
    
    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight });
        }
    }, [conversation]);
    
    if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }


    const handleSendMessage = async () => {
        if (!currentMessage.trim() || !firestore || !user) return;

        const userMessage: ChatMessage = { role: 'user', text: currentMessage.trim() };
        const conversationRef = collection(firestore, 'asha-conversations', 'admin_chat', 'conversation');
        
        // Optimistically add user message to the UI
        setCurrentMessage('');
        await addDoc(conversationRef, { ...userMessage, timestamp: serverTimestamp() });
        
        startThinking(async () => {
            try {
                // Ensure conversation history is not null
                const history = conversation || [];
                const modelResponseText = await chatWithAsha({
                    history: history,
                    message: userMessage.text,
                });

                const modelMessage: ChatMessage = { role: 'model', text: modelResponseText };
                await addDoc(conversationRef, { ...modelMessage, timestamp: serverTimestamp() });

            } catch (error) {
                console.error("Asha AI Flow failed:", error);
                toast({
                    variant: 'destructive',
                    title: 'AI Error',
                    description: 'Asha could not respond. Please try again.',
                });
                // Optionally remove the user's message if the call fails
            }
        });
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-3xl mx-auto h-[75vh] flex flex-col">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <BrainCircuit className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle className="text-3xl font-headline">Asha AI Diagnostic Agent</CardTitle>
                            <CardDescription>A conversational agent to assist with symptom diagnosis.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                        <div className="space-y-6">
                            {isHistoryLoading ? (
                                <p>Loading conversation history...</p>
                            ) : conversation && conversation.length > 0 ? (
                                conversation.map((msg, index) => <ChatBubble key={msg.id || index} message={msg} />)
                            ) : (
                                <div className="text-center text-muted-foreground py-8">
                                    <Sparkles className="mx-auto h-8 w-8 mb-2" />
                                    <p>Start the conversation by asking a question.</p>
                                </div>
                            )}
                            {isThinking && (
                                <div className="flex items-start gap-4 justify-start">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback><Bot /></AvatarFallback>
                                    </Avatar>
                                    <div className="max-w-lg rounded-xl p-3 bg-muted">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <div className="flex items-center gap-2 pt-4 border-t">
                        <Input
                            placeholder="Ask about symptoms..."
                            value={currentMessage}
                            onChange={(e) => setCurrentMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            disabled={isThinking}
                        />
                        <Button onClick={handleSendMessage} disabled={!currentMessage.trim() || isThinking}>
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send Message</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
