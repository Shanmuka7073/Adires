
'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Send, User, Bot, Loader2, Sparkles, Volume2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getWikipediaSummary } from '@/app/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

function formatContent(text: string) {
    // Split the text into paragraphs by newline.
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');

    return paragraphs.map((para, index) => {
        // Check for list-like structures (e.g., "1. item", "- item", "* item")
        if (para.match(/^(\d+\.|\*|-)\s/)) {
            // This logic assumes consecutive list items.
            // A more complex implementation could group non-consecutive list items.
            return (
                <ul key={index} className="list-disc pl-5 space-y-1 my-2">
                    {para.split('\n').map((item, itemIndex) => (
                        <li key={itemIndex}>{item.replace(/^(\d+\.|\*|-)\s/, '')}</li>
                    ))}
                </ul>
            );
        }
        // Render as a normal paragraph
        return <p key={index} className="mb-2 last:mb-0">{para}</p>;
    });
}


function ChatBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';
    const { toast } = useToast();

    const handleSpeak = () => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(message.text);
            window.speechSynthesis.speak(utterance);
        } else {
            toast({
                variant: 'destructive',
                title: 'Text-to-Speech Not Supported',
                description: 'Your browser does not support this feature.',
            });
        }
    };

    return (
        <div className={cn("flex items-start gap-4", isUser ? "justify-end" : "justify-start")}>
             {!isUser && (
                <Avatar className="h-8 w-8">
                    <AvatarFallback><Bot /></AvatarFallback>
                </Avatar>
            )}
            <div className={cn(
                "max-w-xs md:max-w-md lg:max-w-lg rounded-xl p-3 text-sm relative group",
                isUser ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
                <div>{formatContent(message.text)}</div>
                 {!isUser && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={handleSpeak}
                    >
                        <Volume2 className="h-4 w-4" />
                        <span className="sr-only">Read aloud</span>
                    </Button>
                )}
            </div>
            {isUser && (
                 <Avatar className="h-8 w-8">
                    <AvatarFallback><User /></AvatarFallback>
                </Avatar>
            )}
        </div>
    )
}


export default function KnowledgeChatPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isThinking, startThinking] = useTransition();
    const [currentMessage, setCurrentMessage] = useState('');
    const [conversation, setConversation] = useState<ChatMessage[]>([]);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [conversation]);
    
    if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }


    const handleSendMessage = async () => {
        if (!currentMessage.trim()) return;

        const userMessage: ChatMessage = { role: 'user', text: currentMessage.trim() };
        setConversation(prev => [...prev, userMessage]);
        setCurrentMessage('');
        
        startThinking(async () => {
            try {
                const result = await getWikipediaSummary(userMessage.text);
                const botMessageText = result.summary || result.error || "I couldn't find any information on that topic.";
                const botMessage: ChatMessage = { role: 'bot', text: botMessageText };
                setConversation(prev => [...prev, botMessage]);

            } catch (error) {
                console.error("Wikipedia Action failed:", error);
                toast({
                    variant: 'destructive',
                    title: 'Search Error',
                    description: 'Could not fetch information from Wikipedia. Please try again.',
                });
                const errorMessage: ChatMessage = { role: 'bot', text: "Sorry, I ran into an error trying to get that information."};
                setConversation(prev => [...prev, errorMessage]);
            }
        });
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-3xl mx-auto h-[75vh] flex flex-col">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Sparkles className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle className="text-3xl font-headline">Knowledge Chat</CardTitle>
                            <CardDescription>Ask a question to get a summary from Wikipedia.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                        <div className="space-y-6">
                            {conversation.length > 0 ? (
                                conversation.map((msg, index) => <ChatBubble key={index} message={msg} />)
                            ) : (
                                <div className="text-center text-muted-foreground py-8">
                                    <Sparkles className="mx-auto h-8 w-8 mb-2" />
                                    <p>Ask a question to get started. For example: "What is pasteurization?"</p>
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
                            placeholder="Ask about a topic..."
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
