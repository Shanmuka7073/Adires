
'use client';

import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';

interface ChatMessageProps {
    message: Message;
    isOwn: boolean;
}

export function ChatMessage({ message, isOwn }: ChatMessageProps) {
    const time = message.createdAt?.seconds 
        ? format(new Date(message.createdAt.seconds * 1000), 'p') 
        : '...';

    return (
        <div className={cn(
            "flex w-full mb-2",
            isOwn ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "max-w-[80%] px-3 py-2 rounded-2xl relative shadow-sm",
                isOwn 
                    ? "bg-primary text-white rounded-tr-none" 
                    : "bg-white text-gray-900 rounded-tl-none border border-black/5"
            )}>
                {message.type === 'text' && (
                    <p className="text-sm font-medium leading-relaxed break-words">
                        {message.text}
                    </p>
                )}
                
                <div className="flex items-center justify-end gap-1 mt-1">
                    <span className={cn(
                        "text-[9px] font-bold uppercase tracking-tighter opacity-50",
                        isOwn ? "text-white" : "text-gray-400"
                    )}>
                        {time}
                    </span>
                    {isOwn && <CheckCheck className="h-3 w-3 text-white/60" />}
                </div>
            </div>
        </div>
    );
}
