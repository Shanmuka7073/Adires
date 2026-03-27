
'use client';

import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CheckCheck, Play, Pause } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ChatMessageProps {
    message: Message;
    isOwn: boolean;
}

export function ChatMessage({ message, isOwn }: ChatMessageProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    const time = message.createdAt?.seconds 
        ? format(new Date(message.createdAt.seconds * 1000), 'p') 
        : '...';

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    return (
        <div className={cn(
            "flex w-full mb-2",
            isOwn ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "max-w-[85%] px-3 py-2 rounded-2xl relative shadow-sm",
                isOwn 
                    ? "bg-primary text-white rounded-tr-none" 
                    : "bg-white text-gray-900 rounded-tl-none border border-black/5"
            )}>
                {message.type === 'text' && (
                    <p className="text-sm font-medium leading-relaxed break-words">
                        {message.text}
                    </p>
                )}

                {message.type === 'voice' && message.audioUrl && (
                    <div className="flex items-center gap-3 py-1 pr-4 min-w-[160px]">
                        <button 
                            onClick={togglePlay}
                            className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                                isOwn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-primary/10 hover:bg-primary/20 text-primary"
                            )}
                        >
                            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                        </button>
                        
                        <div className="flex-1 h-1 rounded-full bg-current/20 relative overflow-hidden">
                            <div className={cn(
                                "absolute inset-0 bg-current transition-all",
                                isPlaying ? "animate-pulse" : "w-0"
                            )} />
                        </div>
                        
                        <audio 
                            ref={audioRef} 
                            src={message.audioUrl} 
                            onEnded={() => setIsPlaying(false)}
                            className="hidden"
                        />
                    </div>
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
