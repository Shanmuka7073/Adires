
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCart } from '@/lib/cart';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { VoiceCommander } from '@/components/layout/voice-commander';
import { ProfileCompletionChecker } from '@/components/profile-completion-checker';
import { NotificationPermissionManager } from '@/components/layout/notification-permission-manager';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { usePathname } from 'next/navigation';
import { BottomNavBar } from './bottom-nav-bar';
import { useFirebase } from '@/firebase';
import { PriceCheckDisplay, PriceCheckInfo } from './price-check-display';
import { useInstall } from '../install-provider';
import { VoiceCommandContext } from './voice-commander-context';
import { FirestoreCounter } from './firestore-counter';

export function MainLayout({ 
  children,
}: { 
  children: React.ReactNode;
}) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Click the mic to start listening.');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { cartItems } = useCart();
  const { toast } = useToast();
  const pathname = usePathname();
  
  const { user } = useFirebase();
  
  const { setLanguage, isInitialized } = useAppStore();
  const [priceCheckInfo, setPriceCheckInfo] = useState<PriceCheckInfo | null>(null);

  const [voiceTrigger, setVoiceTrigger] = useState(0);
  const [retryCommandText, setRetryCommandText] = useState<string | null>(null);
  const { triggerInstall } = useInstall();

  useEffect(() => {
    if (!isInitialized) return;
    const savedLanguage = localStorage.getItem('app-language');
    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, [isInitialized, setLanguage]);

  const triggerVoicePrompt = useCallback(() => {
    setVoiceTrigger(v => v + 1);
  }, []);

  const retryCommand = useCallback((command: string) => {
    setRetryCommandText(command);
  }, []);

  const showPriceCheck = useCallback((info: PriceCheckInfo) => {
      setPriceCheckInfo(info);
  }, []);
  
  const hidePriceCheck = useCallback(() => {
      setPriceCheckInfo(null);
  }, []);

  return (
    <VoiceCommandContext.Provider value={{ 
        triggerVoicePrompt, 
        retryCommand, 
        showPriceCheck, 
        hidePriceCheck,
        onCartOpenChange: setIsCartOpen,
        isCartOpen,
        voiceEnabled,
        voiceStatus,
        onToggleVoice: () => setVoiceEnabled(prev => !prev),
    }}>
        <div className="relative flex min-h-dvh flex-col bg-background">
        <Header 
            suggestedCommands={[]} // Suggestions handled inside VoiceCommander internally
        />
        {user && isInitialized && (
            <VoiceCommander 
                enabled={voiceEnabled} 
                onStatusUpdate={setVoiceStatus}
                onSuggestions={() => {}} // Suggestions handled via internal state now
                onOpenCart={() => setIsCartOpen(true)}
                onCloseCart={() => setIsCartOpen(false)}
                isCartOpen={isCartOpen}
                cartItems={cartItems}
                voiceTrigger={voiceTrigger}
                triggerVoicePrompt={triggerVoicePrompt}
                retryCommandText={retryCommandText}
                onRetryHandled={() => setRetryCommandText(null)}
                onInstallApp={triggerInstall}
            />
        )}
        <ProfileCompletionChecker />
        <PriceCheckDisplay info={priceCheckInfo} onClose={hidePriceCheck} />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <NotificationPermissionManager />
        <Footer />
        <BottomNavBar />
        <FirestoreCounter />
        </div>
    </VoiceCommandContext.Provider>
  );
}

export function MenuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-background">
        {children}
    </div>
  );
}
