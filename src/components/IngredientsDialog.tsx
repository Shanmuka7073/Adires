
'use client';

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, Zap, X, CheckCircle, Info, Loader2, Sparkles, Star, Scissors, ListChecks } from "lucide-react";
import type { GetIngredientsOutput } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  dishName: string;
  price: number;
  isLoading: boolean;
  calories: number;
  protein: number;
  ingredients: any[]; // Components/Ingredients
  onAdd: () => void;
  itemType?: 'food' | 'service' | 'product';
}

export default function IngredientsDialog({
  open,
  onClose,
  dishName,
  price,
  isLoading,
  calories,
  protein,
  ingredients,
  onAdd,
  itemType = 'food',
}: Props) {
  const isFood = itemType === 'food';
  const isService = itemType === 'service';

  const HeaderIcon = isFood ? '🍗' : isService ? <Scissors className="h-6 w-6 text-primary" /> : <Sparkles className="h-6 w-6 text-primary" />;
  const subtitle = isFood ? 'Balanced • High Protein • Freshly Prepared' : 'Professional • Trusted • Quality Service';
  const listLabel = isFood ? 'What goes into your food' : isService ? 'Process & Materials' : 'Item Details';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 sm:max-w-lg rounded-[2.5rem] overflow-hidden border-0 shadow-2xl">

        {/* HEADER */}
        <div className="relative bg-gradient-to-br from-primary/10 to-blue-50 px-6 pt-8 pb-6 border-b">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 rounded-full p-2 bg-white/50 hover:bg-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <span className="text-3xl">{typeof HeaderIcon === 'string' ? HeaderIcon : ''}</span>
            {typeof HeaderIcon !== 'string' && HeaderIcon}
            <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">
              {dishName}
            </h2>
          </div>

          <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mt-2">
            {subtitle}
          </p>

          {/* NUTRITION - ONLY FOR FOOD */}
          {isFood && (
            <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white p-4 flex items-center gap-3 shadow-sm border border-black/5">
                <Flame className="text-orange-500 h-6 w-6" />
                <div>
                    <p className="text-[8px] font-black uppercase opacity-40">Calories</p>
                    <p className="font-black text-xl">{isLoading ? '...' : calories} <span className="text-[10px] font-bold">kcal</span></p>
                </div>
                </div>

                <div className="rounded-2xl bg-white p-4 flex items-center gap-3 shadow-sm border border-black/5">
                <Zap className="text-green-600 h-6 w-6" />
                <div>
                    <p className="text-[8px] font-black uppercase opacity-40">Protein</p>
                    <p className="font-black text-xl">{isLoading ? '...' : protein} <span className="text-[10px] font-bold">g</span></p>
                </div>
                </div>
            </div>
          )}
        </div>

        {/* DETAILS LIST */}
        <div className="px-6 py-6 space-y-4 max-h-[50vh] overflow-y-auto bg-white">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
            {listLabel}
          </h3>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest opacity-40">Consulting AI Specialist...</p>
            </div>
          ) : ingredients && ingredients.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {ingredients.map((ing, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="rounded-xl px-4 py-2 text-sm font-bold bg-muted/50 border-0"
                >
                  {ing.name} {ing.quantity ? `· ${ing.quantity}` : ''}
                </Badge>
              ))}
            </div>
          ) : (
             <div className="p-6 bg-amber-50 border-2 border-dashed border-amber-200 rounded-3xl text-center">
                  <ListChecks className="h-10 w-10 text-amber-400 mx-auto mb-2 opacity-40"/>
                  <h4 className="font-black text-xs uppercase text-amber-900 tracking-widest">Details Unavailable</h4>
                  <p className="text-[10px] font-bold text-amber-800/60 mt-1">
                    Specific components for this {isService ? 'service' : 'dish'} haven't been added to our catalog yet.
                  </p>
              </div>
          )}


          <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-2xl mt-4">
            <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold leading-tight text-muted-foreground">
                Detailed analysis provided by LocalBasket AI based on standard recipes and service procedures.
            </p>
          </div>
        </div>

        {/* FOOTER CTA */}
        <div className="border-t px-6 py-6 bg-gray-50 flex flex-col gap-4">
          <Button
            onClick={onAdd}
            className="w-full h-16 text-lg font-black uppercase tracking-widest rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
          >
            ₹{price} · {isService ? 'Select for Booking' : 'Add to Order'}
          </Button>

          <p className="text-[9px] font-black uppercase tracking-widest text-center opacity-30">
            Secure processing • Instant confirmation
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
