
'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Zap, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

/**
 * A non-intrusive banner that appears when the user is offline.
 * Intercepts network-dependent actions and provides feedback.
 */
export function OfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

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
          className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-widest">
              Offline Mode
            </span>
            <div className="hidden sm:flex items-center gap-1 ml-2 bg-white/20 px-2 py-0.5 rounded-full">
              <Zap className="h-3 w-3 fill-current" />
              <span className="text-[10px] font-bold">Local-First Persistence On</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <p className="text-[9px] font-bold opacity-80 hidden md:block italic">
                Changes will sync when connection returns.
             </p>
             <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.reload()}
                className="h-7 rounded-lg bg-white/10 border-white/20 hover:bg-white/20 text-white font-black text-[9px] uppercase px-3"
             >
                <RefreshCw className="h-3 w-3 mr-1.5" /> Reconnect
             </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
