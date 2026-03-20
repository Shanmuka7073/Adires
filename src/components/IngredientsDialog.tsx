
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
      <DialogContent className="p-0 sm:max-w-2xl rounded-[2.5rem] overflow-hidden border-0 shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-auto">
        <div className="w-full md:w-[280px] shrink-0 bg-primary/5 flex flex-col">
            <div className="relative aspect-square md:aspect-auto md:flex-1 w-full bg-muted">
                <Image src={item.imageUrl || ADIRES_LOGO} alt={item.name} fill className="object-cover" />
            </div>
            {isFood && (
                <div className="p-6 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-white p-3 flex flex-col items-center shadow-sm border border-black/5">
                        <Flame className="text-orange-500 h-4 w-4 mb-1" />
                        <p className="text-[8px] font-black uppercase opacity-40">Calories</p>
                        <p className="font-black text-sm">450</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 flex flex-col items-center shadow-sm border border-black/5">
                        <Zap className="text-green-600 h-4 w-4 mb-1" />
                        <p className="text-[8px] font-black uppercase opacity-40">Protein</p>
                        <p className="font-black text-sm">24g</p>
                    </div>
                </div>
            )}
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-white">
            <div className="p-6 pb-0">
                <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900 leading-tight">{item.name}</h2>
            </div>

            <ScrollArea className="flex-1 px-6 py-4">
                <div className="space-y-8 pb-10">
                    {customizationGroups.map((group) => (
                        <div key={group.title} className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{group.title}</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {group.options.map((opt) => {
                                    const isSelected = selectedCustoms[group.title]?.some(o => o.name === opt.name);
                                    return (
                                        <button
                                            key={opt.name}
                                            onClick={() => handleToggleOption(group.title, opt, group.multiSelect)}
                                            className={cn(
                                                "flex justify-between items-center p-3 rounded-2xl border-2 transition-all text-sm",
                                                isSelected ? "border-primary bg-primary/5 font-black" : "border-muted-foreground/10"
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                <div className={cn("h-4 w-4 rounded-full border-2", isSelected ? "border-primary bg-primary" : "border-muted-foreground/30")} />
                                                {opt.name}
                                            </span>
                                            {opt.price > 0 && <span className="text-[10px] font-black opacity-40">+ ₹{opt.price}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            <div className="p-6 pt-2 border-t bg-gray-50 flex flex-col gap-3 shrink-0">
                <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[10px] font-black uppercase opacity-40">Total</span>
                    <span className="text-xl font-black text-primary">₹{totalPrice.toFixed(0)}</span>
                </div>
                <Button onClick={() => onAdd(selectedCustoms)} className="w-full h-14 text-base font-black uppercase tracking-widest rounded-2xl">Add to Order</Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
