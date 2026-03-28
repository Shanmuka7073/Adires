'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, CheckCircle2, ShoppingCart, Trash2, X, AlertCircle, Globe, List } from 'lucide-react';
import { parseOrder, type ParsedOrderItem } from '@/lib/nlu/engine';
import type { MenuItem } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VoiceOrderDialogProps {
  open: boolean;
  onClose: () => void;
  menu: MenuItem[];
  storeId: string;
}

const LANGUAGES = [
    { code: 'en-IN', label: 'English' },
    { code: 'te-IN', label: 'Telugu' },
    { code: 'hi-IN', label: 'Hindi' },
];

export function VoiceOrderDialog({ open, onClose, menu, storeId }: VoiceOrderDialogProps) {
  const { addItem } = useCart();
  const { toast } = useToast();
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedOrderItem[]>([]);
  const [step, setStep] = useState<'idle' | 'listening' | 'review'>('idle');
  const [activeLang, setActiveLang] = useState('en-IN');
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = activeLang;

      recognitionRef.current.onresult = (event: any) => {
        const current = event.results[event.results.length - 1][0].transcript;
        setTranscript(current);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
        setStep('idle');
      };
    }
  }, [activeLang]);

  const startListening = () => {
    setTranscript('');
    setParsedItems([]);
    setStep('listening');
    setIsListening(true);
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.warn("Recognition already started");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    
    if (transcript) {
      const results = parseOrder(transcript, menu);
      setParsedItems(results);
      setStep('review');
    } else {
      setStep('idle');
    }
  };

  const removeItem = (index: number) => {
      setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    const validItems = parsedItems.filter(item => item.match);
    
    if (validItems.length === 0) {
      toast({ variant: 'destructive', title: "No valid items", description: "Please ensure detected items match the menu." });
      return;
    }

    validItems.forEach(item => {
      if (item.match) {
        const product = { 
          id: item.match.id, 
          name: item.match.name, 
          storeId, 
          imageId: 'cat-restaurant', 
          isMenuItem: true,
          imageUrl: item.match.imageUrl,
          price: item.match.price
        };
        const variant = { sku: `${item.match.id}-default`, weight: '1 pc', price: item.match.price, stock: 999 };
        addItem(product as any, variant, item.quantity);
      }
    });

    toast({ title: "Order Synced!", description: `Added ${validItems.length} items to your cart.` });
    onClose();
  };

  const reset = () => {
    setStep('idle');
    setTranscript('');
    setParsedItems([]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0 shadow-2xl p-0 overflow-hidden bg-white flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 bg-primary/5 border-b border-black/5 shrink-0">
          <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight text-gray-950">Voice Ordering</DialogTitle>
                <DialogDescription className="text-[10px] font-bold opacity-40 uppercase tracking-widest">
                    Powered by Adires Multilingual NLU
                </DialogDescription>
              </div>
              <div className="flex gap-1">
                  {LANGUAGES.map(l => (
                      <Button 
                        key={l.code}
                        variant={activeLang === l.code ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-[8px] font-black uppercase tracking-tighter rounded-lg"
                        onClick={() => setActiveLang(l.code)}
                      >
                          {l.label}
                      </Button>
                  ))}
              </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
            <div className="p-8 flex flex-col items-center justify-center space-y-8">
            {step === 'idle' && (
                <div className="text-center space-y-6">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary animate-pulse">
                    <Mic className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-lg font-black uppercase tracking-tight">I'm Listening...</h3>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter opacity-60">
                    Say something like "2 Chicken Biryani and 1 Coke"
                    </p>
                </div>
                <Button onClick={startListening} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20">
                    Start Recording
                </Button>
                </div>
            )}

            {step === 'listening' && (
                <div className="text-center space-y-8 w-full">
                <div className="relative h-24 w-24 mx-auto">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                    <div className="relative h-24 w-24 rounded-full bg-primary flex items-center justify-center text-white shadow-2xl">
                    <Mic className="h-10 w-10" />
                    </div>
                </div>
                
                <div className="p-6 rounded-3xl bg-muted/30 border-2 border-dashed min-h-[100px] flex items-center justify-center">
                    <p className="text-lg font-bold text-gray-800 italic">
                    {transcript || "Speak now..."}
                    </p>
                </div>

                <Button onClick={stopListening} variant="destructive" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">
                    Done Ordering
                </Button>
                </div>
            )}

            {step === 'review' && (
                <div className="w-full space-y-6">
                <div className="text-center">
                    <h3 className="text-xl font-black uppercase tracking-tight italic">Order Review</h3>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Confirm or remove detected items</p>
                </div>

                <div className="space-y-3">
                    {parsedItems.map((item, idx) => (
                    <div key={idx} className={cn(
                        "flex justify-between items-center p-4 rounded-2xl border-2 transition-all shadow-sm",
                        item.match ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                    )}>
                        <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-gray-950">{item.quantity}x</span>
                            <span className="font-bold text-sm uppercase truncate">{item.match?.name || item.name}</span>
                        </div>
                        {!item.match && <p className="text-[8px] font-black text-red-600 uppercase mt-1">Item not found in menu</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            {item.match ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />}
                            <button 
                                onClick={() => removeItem(idx)}
                                className="h-8 w-8 rounded-full bg-white text-destructive shadow-sm flex items-center justify-center hover:bg-red-50 transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={reset} className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-2">
                    Retry
                    </Button>
                    <Button 
                        onClick={handleConfirm} 
                        disabled={parsedItems.length === 0}
                        className="flex-[2] h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"
                    >
                    Add to Cart
                    </Button>
                </div>
                </div>
            )}

            {/* Menu Reference Section */}
            <div className="w-full pt-8 border-t border-black/5">
                <div className="flex items-center gap-2 mb-4 px-1">
                    <List className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Restaurant Menu Reference</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {menu.map(item => (
                        <div key={item.id} className="p-3 bg-muted/20 rounded-xl flex justify-between items-center">
                            <span className="text-[11px] font-bold uppercase text-gray-700">{item.name}</span>
                            <span className="text-[10px] font-black text-primary">₹{item.price}</span>
                        </div>
                    ))}
                </div>
            </div>
            </div>
        </ScrollArea>

        <div className="p-4 bg-gray-50 border-t border-black/5 text-center shrink-0">
           <button onClick={onClose} className="text-[10px] font-black uppercase text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
