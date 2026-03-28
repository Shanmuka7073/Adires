'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, CheckCircle2, Trash2, List, RotateCcw, X, Sparkles } from 'lucide-react';
import { runNLU, type ParsedOrderItem } from '@/lib/nlu/engine';
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
  const [cleanedTranscript, setCleanedTranscript] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedOrderItem[]>([]);
  const [activeLang, setActiveLang] = useState('en-IN');
  
  const recognitionRef = useRef<any>(null);

  const processTranscript = useCallback((text: string) => {
    if (!text) {
        setParsedItems([]);
        setCleanedTranscript('');
        return;
    }
    const result = runNLU(text, activeLang, menu);
    setParsedItems(result.items);
    setCleanedTranscript(result.cleanedText);
  }, [menu, activeLang]);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = activeLang;

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
            setTranscript(prev => (prev + ' ' + finalTranscript).trim());
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
            toast({ variant: 'destructive', title: "Mic Error", description: event.error });
        }
      };
    }
  }, [activeLang, toast]);

  useEffect(() => {
      processTranscript(transcript);
  }, [transcript, processTranscript]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
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

    toast({ title: "Order manifest successful!" });
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
                    Local Intelligence Powered
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
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 animate-pulse">
                        {isListening ? 'System Listening...' : 'Tap to command'}
                    </p>
                </div>

                {/* Transcripts Area */}
                {(transcript || cleanedTranscript) && (
                    <div className="space-y-4">
                        {transcript && (
                            <div className="bg-white p-4 rounded-2xl border-2 border-black/5 shadow-sm relative group">
                                <button onClick={() => setTranscript('')} className="absolute -top-2 -right-2 h-6 w-6 bg-white border shadow-sm rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                                    <RotateCcw className="h-3 w-3" />
                                </button>
                                <p className="text-[8px] font-black uppercase text-gray-400 mb-1">Raw Input</p>
                                <p className="text-xs font-bold text-gray-400 italic leading-relaxed">
                                    "{transcript}"
                                </p>
                            </div>
                        )}
                        
                        {cleanedTranscript && (
                            <div className="bg-primary/5 p-4 rounded-2xl border-2 border-primary/10 shadow-sm relative animate-in slide-in-from-bottom-2">
                                <p className="text-[8px] font-black uppercase text-primary mb-1 flex items-center gap-1">
                                    <Sparkles className="h-2 w-2" /> Cleaned Interpretation
                                </p>
                                <p className="text-sm font-black text-gray-900 leading-relaxed uppercase tracking-tight">
                                    {cleanedTranscript}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Detected Items List */}
                {parsedItems.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-1">Order Manifest</h3>
                        {parsedItems.map((item, idx) => (
                            <div key={idx} className={cn(
                                "flex justify-between items-center p-4 rounded-[2rem] border-2 transition-all bg-white shadow-md",
                                item.match ? "border-green-500/20" : "border-red-500/20"
                            )}>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                                            {item.quantity}
                                        </div>
                                        <span className="font-black text-xs uppercase truncate text-gray-950">
                                            {item.match?.name || item.name}
                                        </span>
                                    </div>
                                    {!item.match && <p className="text-[8px] font-black text-red-600 uppercase mt-1 ml-11">Unrecognized product</p>}
                                </div>
                                <button 
                                    onClick={() => removeItem(idx)}
                                    className="h-9 w-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors shadow-sm"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

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
                Synchronize to Cart
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
