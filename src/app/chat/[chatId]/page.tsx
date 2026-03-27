
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Chat } from '@/lib/types';
import { ChatWindow } from '@/components/chat/chat-window';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreVertical, Phone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function ChatDetailPage() {
    const params = useParams();
    const router = useRouter();
    const chatId = Array.isArray(params.chatId) ? params.chatId[0] : params.chatId;
    const { firestore, user } = useFirebase();

    const chatRef = useMemoFirebase(() => 
        firestore && chatId ? doc(firestore, 'chats', chatId) : null, 
    [firestore, chatId]);
    
    const { data: chat, isLoading } = useDoc<Chat>(chatRef);

    if (isLoading || !chat) return null;

    const isOwnerView = chat.participants[0] === user?.uid;
    const displayName = isOwnerView ? chat.customerName : chat.storeName;

    return (
        <div className="flex flex-col h-screen bg-white overflow-hidden">
            {/* WHATSAPP-LIKE HEADER */}
            <header className="h-16 flex items-center justify-between px-2 bg-[#f0f0f0] border-b border-black/5 shrink-0">
                <div className="flex items-center gap-1 min-w-0">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <div className="flex items-center gap-3 cursor-pointer">
                        <Avatar className="h-10 w-10 rounded-full border-2 border-white shadow-sm">
                            <AvatarImage src={isOwnerView ? chat.customerImageUrl : undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-black">
                                {displayName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <h2 className="font-black text-sm uppercase tracking-tight text-gray-950 truncate leading-none">
                                {displayName}
                            </h2>
                            <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mt-1">
                                Online
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="rounded-full text-gray-600">
                        <Phone className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full text-gray-600">
                        <MoreVertical className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            <div className="flex-1 relative">
                <ChatWindow chatId={chatId} />
            </div>
        </div>
    );
}
