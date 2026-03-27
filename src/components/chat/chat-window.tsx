
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import type { Chat, Message } from '@/lib/types';
import { ChatMessage } from './chat-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Smile, Mic, X, Square } from 'lucide-react';
import { sendTextMessage, sendVoiceMessage, markChatAsRead } from '@/lib/chat-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ChatWindowProps {
    chatId: string;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
    const { firestore, user } = useFirebase();
    const [inputText, setInputText] = useState('');
    const [isSending, startSend] = useTransition();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !chatId) return null;
        return query(
            collection(firestore, `chats/${chatId}/messages`),
            orderBy('createdAt', 'asc'),
            limit(100)
        );
    }, [firestore, chatId]);

    const { data: messages, isLoading } = useCollection<Message>(messagesQuery);
    
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

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
            const chatSnap = await getDocs(query(collection(firestore, 'chats'), where('__name__', '==', chatId)));
            const chatData = chatSnap.docs[0]?.data() as Chat;
            const otherId = chatData.participants.find(p => p !== user.uid) || '';

            await sendTextMessage(firestore, chatId, user.uid, text, otherId);
        });
    };

    /* --- VOICE RECORDING LOGIC --- */

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size > 0 && recordingTime > 0) {
                    await processVoiceMessage(audioBlob);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 59) stopRecording();
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            console.error("Mic access denied", err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = null; // Prevent sending
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const processVoiceMessage = async (blob: Blob) => {
        if (!firestore || !user || !chatId) return;
        
        startSend(async () => {
            const chatSnap = await getDocs(query(collection(firestore, 'chats'), where('__name__', '==', chatId)));
            const chatData = chatSnap.docs[0]?.data() as Chat;
            const otherId = chatData.participants.find(p => p !== user.uid) || '';

            await sendVoiceMessage(firestore, chatId, user.uid, blob, otherId);
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
                    {isRecording ? (
                        <div className="flex-1 flex items-center gap-3 bg-red-50 p-2 rounded-2xl border border-red-100 animate-in slide-in-from-bottom-2">
                            <button onClick={cancelRecording} className="h-9 w-9 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm">
                                <X className="h-5 w-5" />
                            </button>
                            <div className="flex-1 flex items-center gap-2 px-2">
                                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs font-black text-red-600 uppercase tracking-widest">
                                    Recording 0:{recordingTime.toString().padStart(2, '0')}
                                </span>
                            </div>
                            <button onClick={stopRecording} className="h-9 w-9 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg">
                                <Square className="h-4 w-4 fill-current" />
                            </button>
                        </div>
                    ) : (
                        <>
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
                            </div>
                            {inputText.trim() ? (
                                <Button 
                                    onClick={handleSend}
                                    disabled={isSending}
                                    className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 text-white p-0 shadow-lg shrink-0"
                                >
                                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </Button>
                            ) : (
                                <Button 
                                    onClick={startRecording}
                                    className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 text-white p-0 shadow-lg shrink-0"
                                >
                                    <Mic className="h-5 w-5" />
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
