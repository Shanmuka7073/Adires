
'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { CallSession } from '@/lib/types';

interface CallOverlayProps {
    call: CallSession;
    onAccept: () => void;
    onDecline: () => void;
}

export function CallOverlay({ call, onAccept, onDecline }: CallOverlayProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Start playing ringtone
        if (typeof window !== 'undefined') {
            const playRingtone = () => {
                try {
                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const oscillator = audioCtx.createOscillator();
                    const gainNode = audioCtx.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioCtx.destination);

                    oscillator.type = 'sine';
                    // A pleasant, pulsating ringtone melody
                    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5);
                    oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 1.0);

                    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.9);

                    oscillator.start();
                    oscillator.stop(audioCtx.currentTime + 1.0);
                } catch (e) {}
            };

            const interval = setInterval(playRingtone, 2000);
            return () => clearInterval(interval);
        }
    }, []);

    return (
        <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[1000] bg-slate-900 text-white flex flex-col items-center justify-between py-24 px-8 overflow-hidden"
        >
            {/* AMBIENT BACKGROUND ANIMATION */}
            <div className="absolute inset-0 opacity-20">
                <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary rounded-full blur-[120px]"
                />
            </div>

            <div className="relative z-10 flex flex-col items-center space-y-6 text-center">
                <div className="relative">
                    <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-primary/20 rounded-full scale-150"
                    />
                    <Avatar className="h-32 w-32 border-4 border-white/10 shadow-2xl relative z-10">
                        <AvatarImage src={call.callerImageUrl} />
                        <AvatarFallback className="bg-primary text-white text-4xl font-black">
                            {call.callerName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </div>
                
                <div className="space-y-2">
                    <h2 className="text-3xl font-black uppercase tracking-tight italic">
                        {call.callerName}
                    </h2>
                    <p className="text-primary font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
                        Incoming In-App Request
                    </p>
                </div>
            </div>

            <div className="relative z-10 w-full max-w-sm grid grid-cols-2 gap-8 px-4">
                <div className="flex flex-col items-center space-y-4">
                    <Button 
                        onClick={onDecline}
                        className="h-20 w-20 rounded-full bg-red-500 hover:bg-red-600 shadow-2xl shadow-red-500/40 p-0"
                    >
                        <PhoneOff className="h-8 w-8 fill-current" />
                    </Button>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Decline</span>
                </div>

                <div className="flex flex-col items-center space-y-4">
                    <Button 
                        onClick={onAccept}
                        className="h-20 w-20 rounded-full bg-green-500 hover:bg-green-600 shadow-2xl shadow-green-500/40 p-0"
                    >
                        <Phone className="h-8 w-8 fill-current animate-bounce" />
                    </Button>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Accept</span>
                </div>
            </div>

            {/* BUTTON TO END/CANCEL FROM TOP IF NEEDED */}
            <button onClick={onDecline} className="absolute top-8 right-8 h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10">
                <X className="h-5 w-5" />
            </button>
        </motion.div>
    );
}
