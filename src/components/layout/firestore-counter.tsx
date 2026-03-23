
'use client';

import { useAppStore } from '@/lib/store';
import { Database, Pencil } from 'lucide-react';

export function FirestoreCounter() {
  const { readCount, writeCount } = useAppStore();

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-[100] bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest rounded-full px-3 py-1.5 shadow-2xl flex items-center gap-3 border border-white/10">
      <div className="flex items-center gap-1.5" title="Firestore Reads">
        <Database className="h-3 w-3 text-primary" />
        <span>R:</span>
        <span className="text-white">{readCount}</span>
      </div>
      <div className="flex items-center gap-1.5" title="Firestore Writes">
        <Pencil className="h-3 w-3 text-amber-500" />
        <span>W:</span>
        <span className="text-white">{writeCount}</span>
      </div>
    </div>
  );
}
