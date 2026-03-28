'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, CheckCircle2, Trash2, List, RotateCcw, X, Sparkles, Plus, Minus } from 'lucide-react';
import { runNLU } from '@/lib/nlu/engine';
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
  const [transcript, setTranscript] = useState(''); // Current segment
  const [parsedItems, setParsedItems] = useState<any[]>([]); // Committed items
  const [activeLang, setActiveLang] = useState('en-IN');
  
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  // Helper to merge items into existing list
  const mergeItems = useCallback((newItems: any[]) => {
      setParsedItems(current => {
          const newList = [...current];
          newItems.forEach(newItem => {
              const existingIndex = newList.findIndex(item => item.name === newItem.name);
              if (existingIndex !== -1) {
                  // Increment quantity of existing item
                  newList[existingIndex] = {
                      ...newList[existingIndex],
                      quantity: newList[existingIndex].quantity + newItem.quantity
                  };
              } else {
                  // Add new item to list
                  newList.push(newItem);
              }
          });
          return newList;
      });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = activeLang;

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptSegment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            // Process and commit final segments immediately
            const result = runNLU(transcriptSegment, activeLang, menu);
            if (result.items.length > 0) {
                mergeItems(result.items);
            }
          } else {
            interimTranscript += transcriptSegment;
          }
        }
        setTranscript(interimTranscript);
      };

      recognitionRef.current.onend = () => {
        // AUTO-RESTART LOGIC: If we should still be listening, start again
        if (isListeningRef.current) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.warn("Recognition restart attempt failed", e);
            }
        } else {
            setIsListening(false);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
            console.error("Speech Recognition Error:", event.error);
            // Don't toast 'no-speech' errors as they are common during pauses
            if (event.error === 'network') {
                toast({ variant: 'destructive', title: "Network Error", description: "Speech recognition interrupted." });
            }
        }
      };
    }

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };
  }, [activeLang, toast, menu, mergeItems]);

  const toggleListening = () => {
    if (isListening) {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      isListeningRef.current = true;
      setIsListening(true);
      setTranscript('');
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.warn("Recognition already started");
      }
    }
  };

  const removeItem = (index: number) => {
      setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateQty = (index: number, delta: number) => {
      setParsedItems(prev => prev.map((item, i) => {
          if (i === index) {
              const newQty = Math.max(1, item.quantity + delta);
              return { ...item, quantity: newQty };
          }
          return item;
      }));
  };

  const handleConfirm = () => {
    const validItems = parsedItems.filter(item => item.match);
    if (validItems.length === 0) {
      toast({ variant: 'destructive', title: "No items detected", description: "Try speaking more clearly." });
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

    toast({ title: "Synchronized to Cart!" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0 shadow-2xl p-0 overflow-hidden bg-[#FDFCF7] flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 bg-white border-b shrink-0">
          <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Voice Hub</DialogTitle>
                <DialogDescription className="text-[10px] font-bold opacity-40 uppercase tracking-widest">
                    Continuous Ordering Enabled
                </DialogDescription>
              </div>
              <div className="flex gap-1 bg-black/5 p-1 rounded-xl">
                  {LANGUAGES.map(l => (
                      <button 
                        key={l.code}
                        className={cn(
                            "px-2 py-1 text-[8px] font-black uppercase rounded-lg transition-all",
                            activeLang === l.code ? "bg-white shadow-sm text-primary" : "text-gray-400"
                        )}
                        onClick={() => {
                            setActiveLang(l.code);
                            setTranscript('');
                        }}
                      >
                          {l.label}
                      </button>
                  ))}
              </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-8">
                {/* Listening Control */}
                <div className="flex flex-col items-center gap-4">
                    <button 
                        onClick={toggleListening}
                        className={cn(
                            "h-20 w-20 rounded-full flex items-center justify-center transition-all duration-500 relative",
                            isListening ? "bg-red-500 shadow-xl shadow-red-500/20 scale-110" : "bg-primary shadow-xl shadow-primary/20"
                        )}
                    >
                        {isListening && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />}
                        {isListening ? <X className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-white" />}
                    </button>
                    <div className="text-center space-y-1">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                            {isListening ? 'System Listening...' : 'Tap to command'}
                        </p>
                        {isListening && transcript && (
                            <p className="text-[10px] font-bold text-primary italic animate-in fade-in slide-in-from-top-1">
                                "{transcript}..."
                            </p>
                        )}
                    </div>
                </div>

                {/* Order Manifest */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Order Manifest</h3>
                        {parsedItems.length > 0 && (
                            <button onClick={() => { setTranscript(''); setParsedItems([]); }} className="text-[8px] font-black uppercase text-destructive tracking-widest flex items-center gap-1">
                                <RotateCcw className="h-2 w-2" /> Reset
                            </button>
                        )}
                    </div>

                    {parsedItems.length > 0 ? (
                        <div className="space-y-3">
                            {parsedItems.map((item, idx) => (
                                <div key={idx} className={cn(
                                    "flex justify-between items-center p-4 rounded-[2rem] border-2 transition-all bg-white shadow-md animate-in slide-in-from-bottom-2",
                                    item.match ? "border-green-500/20" : "border-red-500/20"
                                )}>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 bg-primary/10 rounded-xl px-2 py-1 shrink-0">
                                                <button onClick={() => updateQty(idx, -1)} className="text-primary hover:scale-125 transition-transform"><Minus className="h-3 w-3" /></button>
                                                <span className="font-black text-xs text-primary w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQty(idx, 1)} className="text-primary hover:scale-125 transition-transform"><Plus className="h-3 w-3" /></button>
                                            </div>
                                            <span className="font-black text-xs uppercase truncate text-gray-950">
                                                {item.match?.name || item.name}
                                            </span>
                                        </div>
                                        {!item.match && <p className="text-[8px] font-black text-red-600 uppercase mt-1 ml-14">Unrecognized product</p>}
                                    </div>
                                    <button 
                                        onClick={() => removeItem(idx)}
                                        className="h-9 w-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors shadow-sm ml-2"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center rounded-[2rem] bg-white border-2 border-dashed border-black/5 opacity-30">
                            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                                {isListening ? 'Speak your order naturally...' : 'Your manifest is empty'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Menu Reference */}
                <div className="pt-6 border-t border-black/5">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <List className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Available Catalog</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                        {menu.map(item => (
                            <div key={item.id} className="p-3 bg-white rounded-2xl border border-black/5 flex justify-between items-center text-[10px] font-bold uppercase group hover:border-primary/30 transition-colors">
                                <span className="text-gray-700 truncate">{item.name}</span>
                                <span className="text-primary font-black ml-4 shrink-0">₹{item.price}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        <div className="p-6 border-t bg-white shrink-0 pb-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
            <Button 
                onClick={handleConfirm} 
                disabled={parsedItems.filter(i => i.match).length === 0}
                className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 transition-all active:scale-95"
            >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Add {parsedItems.filter(i => i.match).length} items to cart
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
