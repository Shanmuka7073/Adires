"use client";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ProductVariant } from '@/lib/types';

interface RefConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  candidates: ProductVariant[] | null;
  onSelect: (variant: ProductVariant) => void;
}

export default function RefConfirmDialog({ open, onClose, candidates, onSelect }: RefConfirmDialogProps) {
  if (!candidates) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white p-4 rounded-xl shadow-xl w-[85%] mx-auto">
        <DialogTitle>Select one</DialogTitle>

        <div className="mt-4 space-y-3">
          {candidates.map((c, i) => (
            <button
              key={i}
              className="w-full p-3 border bg-gray-100 rounded-lg text-left"
              onClick={() => onSelect(c)}
            >
              {c.weight} — ₹{c.price}
            </button>
          ))}
        </div>

        <button className="mt-4 text-blue-600" onClick={onClose}>
          Cancel
        </button>
      </DialogContent>
    </Dialog>
  );
}
