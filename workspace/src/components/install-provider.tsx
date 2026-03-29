
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Define the shape of the event object fired by the browser
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallContextType {
  canInstall: boolean;
  triggerInstall: () => void;
}

// Create the context
const InstallContext = createContext<InstallContextType | undefined>(undefined);

/**
 * Provides the logic for handling PWA installation prompts.
 * Enhanced to handle store-specific PWA capture.
 */
export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser prompt from showing automatically
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      console.log('Capture: PWA Install prompt ready');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also check for global custom event dispatched from layout.tsx
    const handleGlobalTrigger = (e: any) => {
        if (window.deferredInstallPrompt) {
            setDeferredPrompt(window.deferredInstallPrompt);
        }
    };
    window.addEventListener('pwa-install-available', handleGlobalTrigger);

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      console.log('App successfully installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-install-available', handleGlobalTrigger);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) {
        console.warn('Install prompt not available yet');
        return;
    }
    
    // Show the install prompt
    await deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    
    // Clear the deferred prompt regardless of the outcome
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const value = {
    canInstall: !!deferredPrompt,
    triggerInstall,
  };

  return (
    <InstallContext.Provider value={value}>
      {children}
    </InstallContext.Provider>
  );
}

/**
 * Hook to access the PWA installation state and trigger.
 */
export function useInstall() {
  const context = useContext(InstallContext);
  if (context === undefined) {
    throw new Error('useInstall must be used within an InstallProvider');
  }
  return context;
}
