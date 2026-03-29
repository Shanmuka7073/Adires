
'use client';

import { useCallback, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { useAppStore } from '@/lib/store';
import { BottomNavBar } from './bottom-nav-bar';
import { useFirebase } from '@/firebase';
import { FirestoreCounter } from './firestore-counter';
import { OfflineStatus } from './offline-status';
import { AuthGuard } from './auth-guard';
import { VoiceCommandContext, PriceCheckInfo } from './voice-commander-context';
import { VoiceCommander } from './voice-commander';
import { useCart } from '@/lib/cart';
import { Toaster } from '@/components/ui/toaster';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { cartItems } = useCart();
  
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Idle');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isVoiceOrderDialogOpen, setIsVoiceOrderDialogOpen] = useState(false);
  const [priceCheckInfo, setPriceCheckInfo] = useState<PriceCheckInfo | null>(null);

  const onToggleVoice = useCallback(() => setVoiceEnabled(prev => !prev), []);
  const triggerVoicePrompt = useCallback(() => setVoiceEnabled(true), []);
  const showPriceCheck = useCallback((info: PriceCheckInfo) => setPriceCheckInfo(info), []);
  const hidePriceCheck = useCallback(() => setPriceCheckInfo(null), []);
  const onCartOpenChange = useCallback((open: boolean) => setIsCartOpen(open), []);

  return (
    <VoiceCommandContext.Provider
      value={{
        triggerVoicePrompt,
        showPriceCheck,
        hidePriceCheck,
        onCartOpenChange,
        isCartOpen,
        voiceEnabled,
        voiceStatus,
        onToggleVoice,
        isVoiceOrderDialogOpen,
        setIsVoiceOrderDialogOpen
      }}
    >
        <AuthGuard>
            <div className="relative flex min-h-dvh flex-col bg-background">
                <OfflineStatus />
                <Header />
                <main className="flex-1 pb-16 md:pb-0">{children}</main>
                
                <VoiceCommander 
                    enabled={voiceEnabled}
                    onStatusUpdate={setVoiceStatus}
                    onOpenCart={() => setIsCartOpen(true)}
                    onCloseCart={() => setIsCartOpen(false)}
                    cartItems={cartItems}
                    voiceTrigger={0}
                    triggerVoicePrompt={triggerVoicePrompt}
                    retryCommandText={null}
                    onRetryHandled={() => {}}
                    onInstallApp={() => {}}
                />

                <Footer />
                <BottomNavBar />
                <FirestoreCounter />
                <Toaster />
            </div>
        </AuthGuard>
    </VoiceCommandContext.Provider>
  );
}
