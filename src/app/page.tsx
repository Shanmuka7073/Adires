'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { stores, isInitialized, loading } = useAppStore();

  useEffect(() => {
    // Only proceed if initialization is complete and not in the middle of loading.
    if (isInitialized && !loading) {
      // Find the master "LocalBasket" store to serve as the default entry point.
      const masterStore = stores.find(s => s.name === 'LocalBasket');
      
      if (masterStore) {
        // Redirect to the master store's page, defaulting to the 'Vegetables' category.
        router.replace(`/stores/${masterStore.id}?category=Vegetables`);
      } else {
        // Fallback: if no master store, go to the generic stores listing page.
        router.replace('/stores');
      }
    }
  }, [stores, isInitialized, loading, router]);

  // Display a loading indicator while the initial data is being fetched and processed.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Preparing your shopping experience...</p>
    </div>
  );
}
