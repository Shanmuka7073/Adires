
'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, MessageSquare, Loader2, Lightbulb, TrendingUp, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { chatWithAsha } from '@/ai/flows/asha-flow';
import type { ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

export function AshaStrategicOverlay() {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [isThinking, startThinking] = useTransition();
    const pathname = usePathname();
    const { isAdmin, isRestaurantOwner } = useAdminAuth();
    const scrollRef = useRef<HTMLDivElement>(null);

    const role = isAdmin ? 'admin' : (isRestaurantOwner ? 'owner' : 'customer');

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [history, isThinking]);

    const handlePredict = () => {
        const message = `Asha, analyze this page (${pathname}) and predict what development is required next. Explain why.`;
        
        setHistory(prev => [...prev, { role: 'user', text: "Analyze for Improvements" }]);
        
        startThinking(async () => {
            try {
                const response = await chatWithAsha({
                    history: history.slice(-5), // Send last few turns for context
                    message: message,
                    role: role,
                    context: { pathname }
                });
                
                setHistory(prev => [...prev, { role: 'model', text: response }]);
            } catch (error) {
                setHistory(prev => [...prev, { role: 'model', text: "I'm having trouble analyzing the system architecture right now. Please try again later." }]);
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
                        className="absolute bottom-16 right-0 w-[90vw] md:w-[400px] mb-4"
                    >
                        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white/95 backdrop-blur-md">
                            <CardHeader className="bg-primary/5 border-b border-black/5 pb-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
                                            <Sparkles className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-black uppercase tracking-tight">Asha Strategic Advisor</CardTitle>
                                            <CardDescription className="text-[10px] font-bold opacity-40 uppercase">AI Product Prediction</CardDescription>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setIsOpen(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 h-[400px] flex flex-col">
                                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                                    <div className="space-y-4">
                                        {history.length === 0 && (
                                            <div className="text-center py-12 px-6">
                                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                                    <Cpu className="h-6 w-6 text-primary opacity-40" />
                                                </div>
                                                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest leading-relaxed">
                                                    Ready to audit <br/><span className="text-primary">{pathname}</span>
                                                </p>
                                            </div>
                                        )}
                                        {history.map((msg, i) => (
                                            <div key={i} className={cn(
                                                "flex flex-col gap-1 max-w-[85%]",
                                                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                                            )}>
                                                <div className={cn(
                                                    "p-3 rounded-2xl text-xs leading-relaxed",
                                                    msg.role === 'user' 
                                                        ? "bg-primary text-white font-bold rounded-tr-none" 
                                                        : "bg-black/5 text-gray-800 font-medium rounded-tl-none border border-black/5"
                                                )}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))}
                                        {isThinking && (
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary animate-pulse ml-2">
                                                <Loader2 className="h-3 w-3 animate-spin" /> Asha is predicting...
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                            <CardFooter className="p-4 border-t border-black/5 bg-gray-50/50">
                                <Button 
                                    onClick={handlePredict} 
                                    disabled={isThinking}
                                    className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20"
                                >
                                    <Lightbulb className="mr-2 h-4 w-4" />
                                    Analyze & Predict Next Step
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
                    "h-14 w-14 rounded-full flex items-center justify-center shadow-2xl transition-colors border-4 border-white",
                    isOpen ? "bg-red-500 text-white" : "bg-primary text-white"
                )}
            >
                {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </motion.button>
        </div>
    );
}
