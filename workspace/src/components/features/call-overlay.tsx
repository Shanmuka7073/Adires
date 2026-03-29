
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, X, User, Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { CallSession } from '@/lib/types';
import { WebRTCManager } from '@/lib/webrtc-service';
import { useFirebase } from '@/firebase';
import { cn } from '@/lib/utils';

interface CallOverlayProps {
    call: CallSession;
    onAccept: () => void;
    onDecline: () => void;
}

export function CallOverlay({ call, onAccept, onDecline }: CallOverlayProps) {
    const { firestore } = useFirebase();
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [duration, setDuration] = useState(0);
    const [status, setStatus] = useState<CallSession['status']>(call.status);
    
    const rtcManagerRef = useRef<WebRTCManager | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (call.status === 'active') {
            setStatus('active');
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [call.status]);

    useEffect(() => {
        // Start playing ringtone if ringing
        if (call.status === 'ringing') {
            const playRingtone = () => {
                try {
                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5);
                    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.9);
                    osc.start();
                    osc.stop(audioCtx.currentTime + 1.0);
                } catch (e) {}
            };
            const interval = setInterval(playRingtone, 2000);
            return () => clearInterval(interval);
        }
    }, [call.status]);

    const handleAcceptCall = async () => {
        if (!firestore) return;
        setIsConnecting(true);
        try {
            const manager = new WebRTCManager(firestore);
            rtcManagerRef.current = manager;
            const streams = await manager.initLocalStream();
            
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = streams.remote;
            }

            await manager.answerCall(call.id);
            setIsConnecting(false);
            onAccept();
        } catch (e) {
            console.error("WebRTC Error:", e);
            onDecline();
        }
    };

    const toggleMute = () => {
        if (rtcManagerRef.current?.localStream) {
            const audioTrack = rtcManagerRef.current.localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            setIsMuted(!audioTrack.enabled);
        }
    };

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[1000] bg-slate-900 text-white flex flex-col items-center justify-between py-24 px-8 overflow-hidden"
        >
            <audio ref={remoteAudioRef} autoPlay className="hidden" />

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
                        className={cn("absolute inset-0 bg-primary/20 rounded-full scale-150", status === 'active' && "hidden")}
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
                    <p className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                        {status === 'active' ? formatDuration(duration) : 'Incoming Audio Request'}
                    </p>
                </div>
            </div>

            {status === 'active' ? (
                <div className="relative z-10 w-full max-w-sm flex justify-around items-center">
                    <div className="flex flex-col items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={toggleMute}
                            className={cn("h-14 w-14 rounded-full border-2", isMuted ? "bg-white text-slate-900" : "bg-white/5 border-white/10")}
                        >
                            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                        </Button>
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Mute</span>
                    </div>

                    <Button 
                        onClick={onDecline}
                        className="h-20 w-20 rounded-full bg-red-500 hover:bg-red-600 shadow-2xl shadow-red-500/40 p-0"
                    >
                        <PhoneOff className="h-8 w-8 fill-current" />
                    </Button>

                    <div className="flex flex-col items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-14 w-14 rounded-full border-2 bg-white/5 border-white/10">
                            <Volume2 className="h-6 w-6" />
                        </Button>
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Speaker</span>
                    </div>
                </div>
            ) : (
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
                            onClick={handleAcceptCall}
                            disabled={isConnecting}
                            className="h-20 w-20 rounded-full bg-green-500 hover:bg-green-600 shadow-2xl shadow-green-500/40 p-0"
                        >
                            {isConnecting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Phone className="h-8 w-8 fill-current" />}
                        </Button>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Accept</span>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
