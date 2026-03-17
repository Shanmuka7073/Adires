'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, MessageSquare, Loader2, Lightbulb, Cpu, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { chatWithAsha } from '@/ai/flows/asha-flow';
import type { ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

export function AshaStrategicOverlay() {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [isThinking, startThinking] = useTransition();
    const pathname = usePathname();
    const { isAdmin, isRestaurantOwner } = useAdminAuth();
    const { userStore } = useAppStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    const role = isAdmin ? 'admin' : (isRestaurantOwner ? 'owner' : 'customer');
    const businessType = userStore?.businessType || (pathname.includes('salon') ? 'salon' : pathname.includes('menu') ? 'restaurant' : 'grocery');

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [history, isThinking]);

    const handlePredict = () => {
        const message = `Asha, perform a strategic audit of ${pathname} for a ${role} in the ${businessType} vertical.`;
        
        // Strictly sanitize history to only include schema-valid fields
        const sanitizedHistory = history.slice(-6).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            text: msg.text
        }));
        
        setHistory(prev => [...prev, { role: 'user', text: "Strategic Audit Request" }]);
        
        startThinking(async () => {
            try {
                const response = await chatWithAsha({
                    history: sanitizedHistory,
                    message: message,
                    role: role,
                    businessType: businessType,
                    context: { pathname }
                });
                
                setHistory(prev => [...prev, { role: 'model', text: response }]);
            } catch (error) {
                console.error("Asha Action Error:", error);
                setHistory(prev => [...prev, { 
                    role: 'model', 
                    text: "I encountered a minor synchronization delay while auditing the platform context. Please try clicking 'Predict Next Feature' again so I can re-run the scan." 
                }]);
            }
        });
    };

    return (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-[100]">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="absolute bottom-16 right-0 w-[90vw] md:w-[450px] mb-4"
                    >
                        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white/95 backdrop-blur-md border-t-4 border-primary">
                            <CardHeader className="bg-primary/5 border-b border-black/5 pb-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                            <Sparkles className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-black uppercase tracking-tight">Asha AI Strategist</CardTitle>
                                            <CardDescription className="text-[10px] font-bold opacity-40 uppercase">Context: {businessType}</CardDescription>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-black/5" onClick={() => setIsOpen(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 h-[400px] md:h-[450px] flex flex-col">
                                <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                                    <div className="space-y-6">
                                        {history.length === 0 && (
                                            <div className="text-center py-16 px-6">
                                                <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                                                    <Cpu className="h-8 w-8 text-primary opacity-40" />
                                                </div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Architecting Growth</p>
                                                <p className="text-xs font-bold text-gray-600 leading-relaxed italic">
                                                    "Click below to analyze this page and see the predicted next stage of development."
                                                </p>
                                            </div>
                                        )}
                                        {history.map((msg, i) => (
                                            <div key={i} className={cn(
                                                "flex flex-col gap-1.5",
                                                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                                            )}>
                                                <div className={cn(
                                                    "p-4 rounded-3xl text-xs leading-relaxed shadow-sm",
                                                    msg.role === 'user' 
                                                        ? "bg-primary text-white font-black rounded-tr-none" 
                                                        : "bg-white text-gray-800 font-medium rounded-tl-none border-2 border-primary/10 prose prose-xs"
                                                )}>
                                                    <div className="whitespace-pre-wrap">{msg.text}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {isThinking && (
                                            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-primary animate-pulse ml-2">
                                                <div className="flex gap-1">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                                                </div>
                                                Running Strategic Scan...
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                            <CardFooter className="p-6 border-t border-black/5 bg-gray-50/50">
                                <Button 
                                    onClick={handlePredict} 
                                    disabled={isThinking}
                                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    <Lightbulb className="mr-2 h-5 w-5" />
                                    Predict Next Feature
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-16 w-16 rounded-full flex items-center justify-center shadow-2xl transition-all border-4 border-white z-50",
                    isOpen ? "bg-red-500 text-white rotate-90" : "bg-primary text-white"
                )}
            >
                {isOpen ? <X className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
            </motion.button>
        </div>
    );
}
