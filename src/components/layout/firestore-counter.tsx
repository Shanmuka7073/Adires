
'use client';

import { useAppStore } from '@/lib/store';
import { Database, Pencil } from 'lucide-react';

export function FirestoreCounter() {
  const { readCount, writeCount } = useAppStore();

  return (
    <div className="fixed bottom-1 md:bottom-4 right-4 z-[100] bg-gray-900 text-white text-xs rounded-full px-3 py-1.5 shadow-lg flex items-center gap-3">
      <div className="flex items-center gap-1.5" title="Firestore Reads">
        <Database className="h-3 w-3" />
        <span>R:</span>
        <span className="font-bold">{readCount}</span>
      </div>
      <div className="flex items-center gap-1.5" title="Firestore Writes">
        <Pencil className="h-3 w-3" />
        <span>W:</span>
        <span className="font-bold">{writeCount}</span>
      </div>
    </div>
  );
}
