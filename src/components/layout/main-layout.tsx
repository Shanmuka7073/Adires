
'use client';

import { useState, createContext, useContext, useCallback, useEffect } from 'react';
import { useCart } from '@/lib/cart';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { VoiceCommander, Command } from '@/components/layout/voice-commander';
import { ProfileCompletionChecker } from '@/components/profile-completion-checker';
import { NotificationPermissionManager } from '@/components/layout/notification-permission-manager';
import { useAppStore } from '@/lib/store';
import { getLanguageForLocation } from '@/lib/location-service';
import { useToast } from '@/hooks/use-toast';
import { usePathname } from 'next/navigation';
import { BottomNavBar } from './bottom-nav-bar';
import { useFirebase } from '@/firebase';
import { PriceCheckDisplay, PriceCheckInfo } from './price-check-display';
import { useInstall } from '../install-provider';
import { CartIcon } from '../cart/cart-icon';
import { Button } from '../ui/button';
import { Mic } from 'lucide-react';

// Create a context to provide the trigger function
const VoiceCommandContext = createContext<{ 
    triggerVoicePrompt: () => void, 
    retryCommand?: (command: string) => void; 
    showPriceCheck: (info: PriceCheckInfo) => void;
    hidePriceCheck: () => void;
    voiceEnabled: boolean;
    voiceStatus: string;
    onToggleVoice: () => void;
    isCartOpen: boolean;
    onCartOpenChange: (open: boolean) => void;
} | undefined>(undefined);

export function useVoiceCommanderContext() {
    const context = useContext(VoiceCommandContext);
    if (!context) {
        throw new Error('useVoiceCommanderContext must be used within a MainLayout or MenuLayout');
    }
    return context;
}

export function SharedVoiceProvider({ children }: { children: React.ReactNode }) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Click the mic to start listening.');
  const [suggestedCommands, setSuggestedCommands] = useState<Command[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { cartItems } = useCart();
  const { toast } = useToast();
  const { user } = useFirebase();
  const { setLanguage, isInitialized } = useAppStore();
  const [priceCheckInfo, setPriceCheckInfo] = useState<PriceCheckInfo | null>(null);
  const [voiceTrigger, setVoiceTrigger] = useState(0);
  const [retryCommandText, setRetryCommandText] = useState<string | null>(null);
  const { triggerInstall } = useInstall();

  useEffect(() => {
    const savedLanguage = localStorage.getItem('app-language');
    if (savedLanguage) {
      setLanguage(savedLanguage);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const detectedLang = getLanguageForLocation(latitude, longitude);
          if (!localStorage.getItem('app-language')) {
            setLanguage(detectedLang);
            toast({
              title: 'Language Detected',
              description: `Voice assistant language set to ${detectedLang === 'te' ? 'Telugu' : 'English'}. You can change this anytime.`,
            });
          }
        }
      );
    }
  }, [setLanguage, toast]);

  const triggerVoicePrompt = useCallback(() => setVoiceTrigger(v => v + 1), []);
  const retryCommand = useCallback((command: string) => setRetryCommandText(command), []);
  const showPriceCheck = useCallback((info: PriceCheckInfo) => setPriceCheckInfo(info), []);
  const hidePriceCheck = useCallback(() => setPriceCheckInfo(null), []);
  const onToggleVoice = useCallback(() => setVoiceEnabled(prev => !prev), []);

  const voiceContextValue = {
    triggerVoicePrompt,
    retryCommand,
    showPriceCheck,
    hidePriceCheck,
    voiceEnabled,
    voiceStatus,
    onToggleVoice,
    isCartOpen,
    onCartOpenChange: setIsCartOpen,
  };

  return (
    <VoiceCommandContext.Provider value={voiceContextValue}>
        {children}
        {isInitialized && (
            <VoiceCommander 
                enabled={voiceEnabled} 
                onStatusUpdate={setVoiceStatus}
                onSuggestions={setSuggestedCommands}
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
        <PriceCheckDisplay info={priceCheckInfo} onClose={hidePriceCheck} />
    </VoiceCommandContext.Provider>
  );
}


export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
        <Header suggestedCommands={[]} />
        <ProfileCompletionChecker />
        <NotificationPermissionManager />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
        <BottomNavBar />
    </div>
  );
}

// Separate the UI part of the MenuLayout
function MenuLayoutContent({ children }: { children: React.ReactNode }) {
    const { onCartOpenChange, isCartOpen, onToggleVoice, voiceEnabled } = useVoiceCommanderContext();
    return (
        <div className="relative min-h-dvh bg-background">
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                 <Button variant="outline" size="icon" className="relative h-14 w-14 rounded-2xl shadow-lg bg-background" onClick={onToggleVoice}>
                    <Mic className="h-7 w-7 text-primary" />
                    {voiceEnabled && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
                    <span className="sr-only">Toggle Voice Commands</span>
                </Button>
                <CartIcon open={isCartOpen} onOpenChange={onCartOpenChange} />
            </div>
        </div>
    );
}

// The main MenuLayout now just provides the context
export function MenuLayout({ children }: { children: React.ReactNode }) {
    return (
        <MenuLayoutContent>{children}</MenuLayoutContent>
    );
}