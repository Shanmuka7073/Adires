
'use client';

export const counterLogicCode = [
    {
        path: 'src/lib/store.ts (Zustand State)',
        content: `
/**
 * ZUSTAND COUNTER LOGIC
 * We maintain a global state for reads and writes.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      readCount: 0,
      writeCount: 0,

      // Function to increment the global read counter
      incrementReadCount: (count = 1) => 
        set(state => ({ readCount: state.readCount + count })),

      // Function to increment the global write counter
      incrementWriteCount: (count = 1) => 
        set(state => ({ writeCount: state.writeCount + count })),
      
      // ... rest of state
    })
  )
);
`
    },
    {
        path: 'src/firebase/firestore/use-collection.tsx (Hook Integration)',
        content: `
/**
 * FIRESTORE HOOK INTEGRATION
 * The useCollection hook automatically updates the global counter
 * whenever a snapshot is received from Firestore.
 */
export function useCollection<T = any>(query: Query) {
  const { incrementReadCount } = useAppStore();

  useEffect(() => {
    const unsubscribe = onSnapshot(query, (snapshot) => {
      // We increment the global read count by the number of docs returned
      incrementReadCount(snapshot.size);
      
      // ... process data
    });
    return () => unsubscribe();
  }, [query, incrementReadCount]);
}
`
    },
    {
        path: 'src/components/layout/firestore-counter.tsx (UI Widget)',
        content: `
/**
 * THE FLOATING UI WIDGET
 * This component displays the counts in the bottom right corner.
 */
export function FirestoreCounter() {
  const { readCount, writeCount } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-gray-900 text-white text-xs rounded-full px-3 py-1.5 shadow-lg flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Database className="h-3 w-3" />
        <span>R:</span>
        <span className="font-bold">{readCount}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Pencil className="h-3 w-3" />
        <span>W:</span>
        <span className="font-bold">{writeCount}</span>
      </div>
    </div>
  );
}
`
    }
];
