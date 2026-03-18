
'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * A non-intrusive banner that appears when the user is offline.
 * Leverages the browser's navigator.onLine API.
 */
export function OfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    // Initial check
    setIsOffline(!window.navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-lg"
        >
          <WifiOff className="h-4 w-4" />
          <span className="text-xs font-black uppercase tracking-widest">
            Offline Mode: Working from local cache
          </span>
          <div className="flex items-center gap-1 ml-2 bg-white/20 px-2 py-0.5 rounded-full">
            <Zap className="h-3 w-3 fill-current" />
            <span className="text-[10px] font-bold">Persistence On</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
