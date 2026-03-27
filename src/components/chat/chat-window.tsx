
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import type { Chat, Message, User } from '@/lib/types';
import { ChatMessage } from './chat-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Smile, Paperclip } from 'lucide-react';
import { sendTextMessage, markChatAsRead } from '@/lib/chat-service';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatWindowProps {
    chatId: string;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
    const { firestore, user } = useFirebase();
    const [inputText, setInputText] = useState('');
    const [isSending, startSend] = useTransition();
    const scrollRef = useRef<HTMLDivElement>(null);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !chatId) return null;
        return query(
            collection(firestore, `chats/${chatId}/messages`),
            orderBy('createdAt', 'asc'),
            limit(100)
        );
    }, [firestore, chatId]);

    const { data: messages, isLoading } = useCollection<Message>(messagesQuery);
    
    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Mark as read when messages arrive
    useEffect(() => {
        if (firestore && chatId && user) {
            markChatAsRead(firestore, chatId, user.uid);
        }
    }, [firestore, chatId, user, messages?.length]);

    const handleSend = () => {
        if (!inputText.trim() || !firestore || !user) return;
        
        const text = inputText.trim();
        setInputText('');

        startSend(async () => {
            // Find other participant
            const chatSnap = await getDocs(query(collection(firestore, 'chats'), where('__name__', '==', chatId)));
            const chatData = chatSnap.docs[0]?.data() as Chat;
            const otherId = chatData.participants.find(p => p !== user.uid) || '';

            await sendTextMessage(firestore, chatId, user.uid, text, otherId);
        });
    };

    if (isLoading) return <div className="flex-1 flex items-center justify-center opacity-20"><Loader2 className="animate-spin h-8 w-8" /></div>;

    return (
        <div className="flex flex-col h-full bg-[#efeae2]">
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
                <div className="flex flex-col">
                    {messages?.map((msg) => (
                        <ChatMessage 
                            key={msg.id} 
                            message={msg} 
                            isOwn={msg.senderId === user?.uid} 
                        />
                    ))}
                </div>
            </ScrollArea>

            <div className="p-3 bg-[#f0f0f0] border-t border-black/5">
                <div className="max-w-3xl mx-auto flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="rounded-full shrink-0 text-gray-500">
                        <Smile className="h-6 w-6" />
                    </Button>
                    <div className="flex-1 relative">
                        <Input 
                            placeholder="Type a message..." 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            className="h-11 rounded-2xl bg-white border-0 shadow-sm pl-4 pr-10 font-medium"
                        />
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-9 w-9 text-gray-400">
                            <Paperclip className="h-5 w-5" />
                        </Button>
                    </div>
                    <Button 
                        onClick={handleSend}
                        disabled={!inputText.trim() || isSending}
                        className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 text-white p-0 shadow-lg shrink-0"
                    >
                        {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
