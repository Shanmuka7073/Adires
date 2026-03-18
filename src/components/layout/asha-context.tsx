'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface AshaContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  externalMessage: string | null;
  setExternalMessage: (msg: string | null) => void;
  triggerAsha: (message: string) => void;
}

export const AshaContext = createContext<AshaContextType | undefined>(undefined);

/**
 * Provides a global state for the Asha Strategic AI overlay.
 * This allows buttons on any page (like the Admin Hub) to open the AI assistant
 * with a pre-filled strategic intent.
 */
export function AshaProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [externalMessage, setExternalMessage] = useState<string | null>(null);

  const triggerAsha = useCallback((message: string) => {
    setExternalMessage(message);
    setIsOpen(true);
  }, []);

  return (
    <AshaContext.Provider value={{ 
        isOpen, 
        setIsOpen, 
        externalMessage, 
        setExternalMessage, 
        triggerAsha 
    }}>
      {children}
    </AshaContext.Provider>
  );
}

/**
 * Hook to access Asha's control functions.
 */
export function useAsha() {
  const context = useContext(AshaContext);
  if (!context) {
    throw new Error('useAsha must be used within an AshaProvider');
  }
  return context;
}
