
'use client';

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, Zap, X, CheckCircle } from "lucide-react";

type Ingredient = {
  name: string;
  qty: string;
  icon?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  dishName: string;
  price: number;
  calories: number;
  protein: number;
  ingredients: Ingredient[];
  onAdd: () => void;
}

export default function IngredientsDialog({
  open,
  onClose,
  dishName,
  price,
  calories,
  protein,
  ingredients,
  onAdd,
}: Props) {
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

          <h2 className="text-2xl font-bold text-gray-900">
            🍗 {dishName}
          </h2>

          <p className="text-sm text-green-700 mt-1">
            Balanced • High Protein • Freshly Prepared
          </p>

          {/* NUTRITION */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-3 flex items-center gap-2 shadow-sm">
              <Flame className="text-orange-500 h-5 w-5" />
              <div>
                <p className="text-xs text-muted-foreground">Calories</p>
                <p className="font-bold text-lg">{calories} kcal</p>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 flex items-center gap-2 shadow-sm">
              <Zap className="text-green-600 h-5 w-5" />
              <div>
                <p className="text-xs text-muted-foreground">Protein</p>
                <p className="font-bold text-lg">{protein} g</p>
              </div>
            </div>
          </div>
        </div>

        {/* INGREDIENTS */}
        <div className="px-5 py-4 space-y-4 max-h-[55vh] overflow-y-auto">
          <h3 className="font-semibold text-gray-800">
            What goes into your food
          </h3>

          <div className="flex flex-wrap gap-2">
            {ingredients.map((ing, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="rounded-full px-3 py-1 text-sm"
              >
                {ing.icon && <span className="mr-1">{ing.icon}</span>}
                {ing.name} · {ing.qty}
              </Badge>
            ))}
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Ingredients & nutrition are approximate per serving
          </p>
        </div>

        {/* FOOTER CTA */}
        <div className="border-t px-5 py-4 bg-white">
          <Button
            onClick={onAdd}
            className="w-full h-12 text-lg font-bold rounded-xl"
          >
            ₹{price} · Add to Bill
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-2">
            Added instantly to your live bill
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
