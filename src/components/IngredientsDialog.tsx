'use client';

import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, Zap, X, CheckCircle, Info, Loader2, Sparkles, Star, Check, Plus, ArrowRight } from "lucide-react";
import type { MenuItem, CustomizationOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

interface Props {
  open: boolean;
  onClose: () => void;
  item: MenuItem;
  isLoading: boolean;
  ingredients: any[]; 
  recommendations: MenuItem[];
  onAdd: (customizations: Record<string, CustomizationOption[]>) => void;
  onShowRecommendation: (item: MenuItem) => void;
  itemType?: 'food' | 'service' | 'product';
}

export default function IngredientsDialog({
  open,
  onClose,
  item,
  isLoading,
  ingredients,
  recommendations,
  onAdd,
  onShowRecommendation,
  itemType = 'food',
}: Props) {
  const [selectedCustoms, setSelectedCustoms] = useState<Record<string, CustomizationOption[]>>({});
  const isFood = itemType === 'food';

  const customizationGroups = item.customizations || [];

  const handleToggleOption = (groupTitle: string, option: CustomizationOption, multi: boolean = false) => {
      setSelectedCustoms(prev => {
          const current = prev[groupTitle] || [];
          if (multi) {
              const isSelected = current.find(o => o.name === option.name);
              return {
                  ...prev,
                  [groupTitle]: isSelected ? current.filter(o => o.name !== option.name) : [...current, option]
              };
          } else {
              return { ...prev, [groupTitle]: [option] };
          }
      });
  };

  const totalPrice = useMemo(() => {
      const customsCost = Object.values(selectedCustoms).flat().reduce((acc, o) => acc + o.price, 0);
      return item.price + customsCost;
  }, [item.price, selectedCustoms]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 sm:max-w-2xl rounded-[2.5rem] md:rounded-[2.5rem] overflow-hidden border-0 shadow-2xl flex flex-col md:flex-row h-[92vh] md:h-auto max-h-[92vh] md:max-h-[85vh]">
        {/* Left Column: Media & Stats */}
        <div className="w-full md:w-[260px] shrink-0 bg-primary/5 flex flex-col h-[30vh] md:h-auto relative">
            <div className="relative flex-1 w-full bg-muted">
                <Image src={item.imageUrl || ADIRES_LOGO} alt={item.name} fill className="object-cover" />
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center md:hidden z-10"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            {isFood && (
                <div className="p-4 grid grid-cols-2 gap-2 bg-white/50 backdrop-blur-sm border-t md:border-t-0">
                    <div className="rounded-xl bg-white p-2.5 flex flex-col items-center shadow-sm border border-black/5">
                        <Flame className="text-orange-500 h-3.5 w-3.5 mb-1" />
                        <p className="text-[7px] font-black uppercase opacity-40">Calories</p>
                        <p className="font-black text-xs">450</p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 flex flex-col items-center shadow-sm border border-black/5">
                        <Zap className="text-green-600 h-3.5 w-3.5 mb-1" />
                        <p className="text-[7px] font-black uppercase opacity-40">Protein</p>
                        <p className="font-black text-xs">24g</p>
                    </div>
                </div>
            )}
        </div>

        {/* Right Column: Content & Options */}
        <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden relative">
            <div className="p-5 pb-2 shrink-0 flex justify-between items-start">
                <div className="min-w-0">
                    <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-gray-950 leading-tight truncate">{item.name}</h2>
                    <p className="text-[8px] font-black uppercase tracking-widest text-primary opacity-60">Chef's Choice</p>
                </div>
                <button 
                    onClick={onClose}
                    className="h-8 w-8 rounded-full hover:bg-black/5 text-gray-400 hidden md:flex items-center justify-center shrink-0"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <ScrollArea className="flex-1 px-5">
                <div className="space-y-6 pb-6">
                    {item.description && (
                        <p className="text-xs font-bold text-gray-500 leading-relaxed italic opacity-80">{item.description}</p>
                    )}

                    {customizationGroups.length > 0 ? customizationGroups.map((group) => (
                        <div key={group.title} className="space-y-3">
                            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">{group.title}</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {group.options.map((opt) => {
                                    const isSelected = selectedCustoms[group.title]?.some(o => o.name === opt.name);
                                    return (
                                        <button
                                            key={opt.name}
                                            onClick={() => handleToggleOption(group.title, opt, group.multiSelect)}
                                            className={cn(
                                                "flex justify-between items-center p-3.5 rounded-2xl border-2 transition-all text-xs",
                                                isSelected ? "border-primary bg-primary/5 font-black" : "border-muted-foreground/10 hover:border-black/10"
                                            )}
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <div className={cn(
                                                    "h-4 w-4 rounded-full border-2 transition-all", 
                                                    isSelected ? "border-primary bg-primary scale-110" : "border-muted-foreground/30"
                                                )} />
                                                <span className="uppercase font-bold">{opt.name}</span>
                                            </span>
                                            {opt.price > 0 && <span className="text-[10px] font-black opacity-40">+ ₹{opt.price}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )) : (
                        <div className="py-10 text-center opacity-20 flex flex-col items-center gap-3">
                            <Sparkles className="h-8 w-8" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No options available</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Sticky Action Footer */}
            <div className="p-5 border-t bg-gray-50/80 backdrop-blur-md flex flex-col gap-3 shrink-0 pb-10 md:pb-5">
                <div className="flex justify-between items-baseline px-1">
                    <span className="text-[9px] font-black uppercase opacity-40 tracking-widest">Selected Total</span>
                    <span className="text-2xl font-black text-primary tracking-tighter">₹{totalPrice.toFixed(0)}</span>
                </div>
                <Button 
                    onClick={() => onAdd(selectedCustoms)} 
                    className="w-full h-14 text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all"
                >
                    Add to Order
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
