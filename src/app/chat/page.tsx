
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Chat } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, MessageSquare, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function ChatListPage() {
    const { firestore, user } = useFirebase();
    const router = useRouter();

    const chatsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'chats'),
            where('participants', 'array-contains', user.uid),
            orderBy('updatedAt', 'desc'),
            limit(50)
        );
    }, [firestore, user]);

    const { data: chats, isLoading } = useCollection<Chat>(chatsQuery);

    if (isLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    return (
        <div className="container mx-auto max-w-2xl min-h-screen flex flex-col bg-white">
            <header className="p-4 border-b flex items-center gap-4 sticky top-0 bg-white z-10">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-xl font-black uppercase tracking-tight">Messages</h1>
            </header>

            <div className="flex-1 overflow-y-auto">
                {!chats || chats.length === 0 ? (
                    <div className="p-20 text-center opacity-30 flex flex-col items-center gap-4">
                        <MessageSquare className="h-16 w-16 opacity-20" />
                        <p className="font-black uppercase tracking-widest text-xs">No active chats</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {chats.map((chat) => {
                            const isOwnerView = chat.participants[0] === user?.uid;
                            const displayName = isOwnerView ? chat.customerName : chat.storeName;
                            const unread = chat.unreadCount?.[user?.uid || ''] || 0;
                            const time = chat.updatedAt?.seconds 
                                ? format(new Date(chat.updatedAt.seconds * 1000), 'p') 
                                : '';

                            return (
                                <Link 
                                    key={chat.id} 
                                    href={`/chat/${chat.id}`}
                                    className="block hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-4 p-4">
                                        <Avatar className="h-14 w-14 rounded-2xl border-2 border-black/5">
                                            <AvatarImage src={isOwnerView ? chat.customerImageUrl : undefined} />
                                            <AvatarFallback className="bg-primary/10 text-primary font-black">
                                                {displayName.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex justify-between items-baseline">
                                                <h3 className="font-black text-sm uppercase truncate text-gray-950">
                                                    {displayName}
                                                </h3>
                                                <span className="text-[10px] font-bold text-gray-400">
                                                    {time}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <p className={cn(
                                                    "text-xs truncate",
                                                    unread > 0 ? "font-bold text-gray-950" : "text-gray-500 font-medium"
                                                )}>
                                                    {chat.lastMessage}
                                                </p>
                                                {unread > 0 && (
                                                    <span className="h-5 min-w-[20px] rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center px-1.5 shadow-lg shadow-primary/20">
                                                        {unread}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
