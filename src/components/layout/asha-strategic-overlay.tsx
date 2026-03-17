'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, MessageSquare, Loader2, Lightbulb, Cpu, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { chatWithAsha } from '@/ai/flows/asha-flow';
import type { ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

export function AshaStrategicOverlay() {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isThinking, startThinking] = useTransition();
    const pathname = usePathname();
    const { isAdmin, isRestaurantOwner } = useAdminAuth();
    const { userStore } = useAppStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    const role = isAdmin ? 'admin' : (isRestaurantOwner ? 'owner' : 'customer');
    const businessType = userStore?.businessType || (pathname.includes('salon') ? 'salon' : pathname.includes('menu') ? 'restaurant' : 'grocery');

    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
            }
        }
    }, [history, isThinking]);

    const handleSendMessage = (customMessage?: string) => {
        const message = customMessage || inputText;
        if (!message.trim() || isThinking) return;

        const newUserMessage: ChatMessage = { role: 'user', text: message };
        setHistory(prev => [...prev, newUserMessage]);
        setInputText('');
        
        // strictly filter history to avoid serialization/schema issues
        const sanitizedHistory = history.slice(-10).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            text: msg.text
        }));
        
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
            } catch (error: any) {
                console.error("Asha Action Error:", error);
                setHistory(prev => [...prev, { 
                    role: 'model', 
                    text: `❌ **Asha Error**: ${error?.message || "Internal server error."}. Please try your question again.` 
                }]);
            }
        });
    };

    const handlePredictShortcut = () => {
        handleSendMessage(`Perform a strategic audit of ${pathname} and predict the next development step.`);
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
                        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white/95 backdrop-blur-md border-t-4 border-primary h-[600px] flex flex-col">
                            <CardHeader className="bg-primary/5 border-b border-black/5 pb-4 shrink-0">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                            <Sparkles className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-black uppercase tracking-tight">Asha Strategic AI</CardTitle>
                                            <CardDescription className="text-[10px] font-bold opacity-40 uppercase">Architecture & Growth Advisor</CardDescription>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-black/5" onClick={() => setIsOpen(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gray-50/30">
                                <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                                    <div className="space-y-6">
                                        {history.length === 0 && (
                                            <div className="text-center py-16 px-6">
                                                <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                                                    <Cpu className="h-8 w-8 text-primary opacity-40" />
                                                </div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Analyzing: {pathname}</p>
                                                <p className="text-xs font-bold text-gray-600 leading-relaxed">
                                                    "I am monitoring the platform context. You can ask me anything about technical performance, growth strategy, or development steps."
                                                </p>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={handlePredictShortcut}
                                                    className="mt-6 rounded-full border-primary/20 text-primary font-black uppercase text-[9px] tracking-widest px-6"
                                                >
                                                    <Lightbulb className="mr-2 h-3.5 w-3.5" /> Predict Improvements
                                                </Button>
                                            </div>
                                        )}
                                        {history.map((msg, i) => (
                                            <div key={i} className={cn(
                                                "flex flex-col gap-1.5",
                                                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                                            )}>
                                                <div className={cn(
                                                    "p-4 rounded-3xl text-[13px] leading-relaxed shadow-sm max-w-[85%]",
                                                    msg.role === 'user' 
                                                        ? "bg-primary text-white font-bold rounded-tr-none" 
                                                        : "bg-white text-gray-800 font-medium rounded-tl-none border-2 border-primary/10"
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
                                                Consulting System Blueprints...
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            <CardFooter className="p-4 border-t border-black/5 bg-white shrink-0">
                                <div className="flex w-full gap-2 bg-[#F1F3F5] p-1.5 rounded-2xl border border-gray-200">
                                    <Input 
                                        placeholder="Ask Asha about the app..." 
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                        className="border-0 bg-transparent focus-visible:ring-0 shadow-none text-sm placeholder:text-gray-400 font-medium h-10"
                                    />
                                    <Button 
                                        size="icon" 
                                        onClick={() => handleSendMessage()}
                                        disabled={!inputText.trim() || isThinking}
                                        className="rounded-xl h-10 w-10 shrink-0 shadow-lg shadow-primary/20"
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
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
