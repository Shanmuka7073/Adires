'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCart } from '@/lib/cart';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { VoiceCommander } from '@/components/layout/voice-commander';
import { ProfileCompletionChecker } from '@/components/profile-completion-checker';
import { NotificationPermissionManager } from '@/components/layout/notification-permission-manager';
import { useAppStore, useInitializeApp } from '@/lib/store';
import { usePathname } from 'next/navigation';
import { BottomNavBar } from './bottom-nav-bar';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { PriceCheckDisplay, PriceCheckInfo } from './price-check-display';
import { useInstall } from '../install-provider';
import { VoiceCommandContext } from './voice-commander-context';
import { FirestoreCounter } from './firestore-counter';
import { OfflineStatus } from './offline-status';
import { doc } from 'firebase/firestore';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { Cog, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function MaintenanceOverlay() {
    return (
        <div className="fixed inset-0 z-[300] bg-background flex items-center justify-center p-6 text-center">
            <Card className="max-w-md rounded-[3rem] border-0 shadow-2xl p-10 bg-white">
                <CardHeader className="flex flex-col items-center gap-6">
                    <div className="h-20 w-20 rounded-[2.5rem] bg-amber-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/20 animate-pulse">
                        <Cog className="h-10 w-10 animate-spin-slow" />
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black font-headline tracking-tighter uppercase italic">System Upgrade</CardTitle>
                        <CardDescription className="font-bold text-gray-500 mt-2">
                            Adires is briefly offline for platform maintenance.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-sm font-medium text-gray-600 leading-relaxed">
                        We are currently scaling our servers to provide you with a faster, smoother experience. We'll be back online in a few moments!
                    </p>
                    <div className="p-4 bg-muted/30 rounded-2xl border border-black/5 flex items-center gap-3">
                        <Zap className="h-5 w-5 text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Status: Scaling Resources</p>
                    </div>
                </CardContent>
            </Card>
            <style jsx global>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
            `}</style>
        </div>
    );
}

export function MainLayout({ 
  children,
}: { 
  children: React.ReactNode;
}) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Click the mic to start listening.');
  const [suggestedCommands, setSuggestedCommands] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { cartItems } = useCart();
  
  const { firestore } = useFirebase();
  const { isAdmin } = useAdminAuth();
  const { setLanguage, isInitialized } = useAppStore();
  const [priceCheckInfo, setPriceCheckInfo] = useState<PriceCheckInfo | null>(null);

  const [voiceTrigger, setVoiceTrigger] = useState(0);
  const [retryCommandText, setRetryCommandText] = useState<string | null>(null);
  const { triggerInstall } = useInstall();

  useInitializeApp();

  const statusRef = useMemoFirebase(() => firestore ? doc(firestore, 'siteConfig', 'appStatus') : null, [firestore]);
  const { data: appStatus } = useDoc<any>(statusRef);
  const isMaintenanceActive = appStatus?.isMaintenance && !isAdmin;

  useEffect(() => {
    if (!isInitialized) return;
    const savedLanguage = localStorage.getItem('app-language');
    if (savedLanguage) setLanguage(savedLanguage);
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

  const onToggleVoice = useCallback(() => setVoiceEnabled(prev => !prev), []);

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
        onToggleVoice,
    }}>
        <div className="relative flex min-h-dvh flex-col bg-background">
        {isMaintenanceActive && <MaintenanceOverlay />}
        <OfflineStatus />
        <Header 
            suggestedCommands={suggestedCommands} 
        />
        {isInitialized && (
            <VoiceCommander 
                enabled={voiceEnabled} 
                onStatusUpdate={setVoiceStatus}
                onOpenCart={() => setIsCartOpen(true)}
                onCloseCart={() => setIsCartOpen(false)}
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
