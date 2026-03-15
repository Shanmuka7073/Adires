
'use client';

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, Zap, X, CheckCircle, Info, Loader2, Sparkles, Star, Scissors } from "lucide-react";
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
      <DialogContent className="p-0 sm:max-w-lg rounded-2xl overflow-hidden">

        {/* HEADER */}
        <div className="relative bg-gradient-to-br from-green-50 to-green-100 px-5 pt-5 pb-4">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 hover:bg-black/10"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-2xl">{typeof HeaderIcon === 'string' ? HeaderIcon : ''}</span>
            {typeof HeaderIcon !== 'string' && HeaderIcon}
            <h2 className="text-2xl font-bold text-gray-900">
              {dishName}
            </h2>
          </div>

          <p className="text-sm text-green-700 mt-1 font-medium">
            {subtitle}
          </p>

          {/* NUTRITION - ONLY FOR FOOD */}
          {isFood && (
            <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3 flex items-center gap-2 shadow-sm">
                <Flame className="text-orange-500 h-5 w-5" />
                <div>
                    <p className="text-xs text-muted-foreground">Calories</p>
                    <p className="font-bold text-lg">{isLoading ? '...' : calories} kcal</p>
                </div>
                </div>

                <div className="rounded-xl bg-white p-3 flex items-center gap-2 shadow-sm">
                <Zap className="text-green-600 h-5 w-5" />
                <div>
                    <p className="text-xs text-muted-foreground">Protein</p>
                    <p className="font-bold text-lg">{isLoading ? '...' : protein} g</p>
                </div>
                </div>
            </div>
          )}
        </div>

        {/* DETAILS LIST */}
        <div className="px-5 py-4 space-y-4 max-h-[55vh] overflow-y-auto">
          <h3 className="font-semibold text-gray-800">
            {listLabel}
          </h3>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2">Fetching details...</p>
            </div>
          ) : ingredients && ingredients.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {ingredients.map((ing, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-sm font-medium"
                >
                  {ing.name} {ing.quantity ? `· ${ing.quantity}` : ''}
                </Badge>
              ))}
            </div>
          ) : (
             <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded-r-lg">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5"/>
                    <h4 className="font-bold">Details Not Available</h4>
                  </div>
                  <p className="text-sm mt-1">
                    Specific {isFood ? 'ingredients' : 'details'} for this item haven't been added yet.
                  </p>
              </div>
          )}


          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Information provided by LocalBasket AI.
          </p>
        </div>

        {/* FOOTER CTA */}
        <div className="border-t px-5 py-4 bg-white">
          <Button
            onClick={onAdd}
            className="w-full h-12 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90"
          >
            ₹{price} · {isService ? 'Book Now' : 'Add to Bill'}
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-2">
            Added instantly to your live bill
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
