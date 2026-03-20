'use client';

import { useState, createContext, useContext, useCallback, useEffect } from 'react';
import { useCart } from '@/lib/cart';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ProfileCompletionChecker } from '@/components/profile-completion-checker';
import { NotificationPermissionManager } from '@/components/layout/notification-permission-manager';
import { useInitializeApp, useAppStore } from '@/lib/store';
import { useFirebase } from '@/firebase';
import { BottomNavBar } from './bottom-nav-bar';
import { VoiceCommandContext } from './voice-commander-context';

export function MainLayout({ 
  children,
}: { 
  children: React.ReactNode;
}) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  useInitializeApp();

  const { setLanguage, isInitialized } = useAppStore();

  useEffect(() => {
    if (!isInitialized) return;
    const savedLanguage = localStorage.getItem('app-language');
    if (savedLanguage) setLanguage(savedLanguage);
  }, [isInitialized, setLanguage]);

  return (
    <VoiceCommandContext.Provider value={{ 
        triggerVoicePrompt: () => {}, 
        showPriceCheck: () => {}, 
        hidePriceCheck: () => {},
        onCartOpenChange: setIsCartOpen,
        isCartOpen,
        voiceEnabled: false,
        voiceStatus: '',
        onToggleVoice: () => {},
    }}>
        <div className="relative flex min-h-dvh flex-col bg-background">
        <Header />
        <ProfileCompletionChecker />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <NotificationPermissionManager />
        <Footer />
        <BottomNavBar />
        </div>
    </VoiceCommandContext.Provider>
  );
}