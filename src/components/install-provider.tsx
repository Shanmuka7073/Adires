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
 * It listens for the `beforeinstallprompt` event and exposes a function
 * to trigger the installation UI.
 */
export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if the event was already captured by the early-capture script in layout.tsx
    const checkGlobalPrompt = () => {
        if ((window as any).deferredInstallPrompt) {
            setDeferredPrompt((window as any).deferredInstallPrompt);
        }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      (window as any).deferredInstallPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for the standard event
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Listen for our custom event from the early-capture script
    window.addEventListener('pwa-install-available', checkGlobalPrompt);

    // Run an initial check
    checkGlobalPrompt();

    // Listen for the appinstalled event to clean up
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      (window as any).deferredInstallPrompt = null;
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-install-available', checkGlobalPrompt);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    await deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // Clear the prompt after use
    setDeferredPrompt(null);
    (window as any).deferredInstallPrompt = null;
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
