
'use client';

import { useState, createContext, useContext, useCallback, useEffect } from 'react';
import { useCart } from '@/lib/cart';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { VoiceCommander, Command } from '@/components/layout/voice-commander';
import { ProfileCompletionChecker } from '@/components/profile-completion-checker';
import { NotificationPermissionManager } from '@/components/layout/notification-permission-manager';
import { useInitializeApp, useAppStore } from '@/lib/store';
import { getLanguageForLocation } from '@/lib/location-service';
import { useToast } from '@/hooks/use-toast';
import { usePathname } from 'next/navigation';
import { BottomNavBar } from './bottom-nav-bar';
import { useFirebase } from '@/firebase';
import { PriceCheckDisplay, PriceCheckInfo } from './price-check-display';

// Create a context to provide the trigger function
const VoiceCommandContext = createContext<{ 
    triggerVoicePrompt: () => void, 
    retryCommand?: (command: string) => void; 
    showPriceCheck: (info: PriceCheckInfo) => void;
} | undefined>(undefined);

export function useVoiceCommanderContext() {
    const context = useContext(VoiceCommandContext);
    if (!context) {
        throw new Error('useVoiceCommanderContext must be used within a MainLayout');
    }
    return context;
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
  const { toast } = useToast();
  const pathname = usePathname();
  
  const { user } = useFirebase();
  
  // This hook now correctly handles the initial data load for the entire app
  useInitializeApp();

  const { setLanguage, isInitialized } = useAppStore();
  const [priceCheckInfo, setPriceCheckInfo] = useState<PriceCheckInfo | null>(null);

  // State to trigger re-evaluation in VoiceCommander
  const [voiceTrigger, setVoiceTrigger] = useState(0);
  const [retryCommandText, setRetryCommandText] = useState<string | null>(null);

  // --- Location-based language detection ---
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
        },
        (error) => {
          console.warn(`Could not get location for language detection: ${error.message}`);
        },
        {
          timeout: 10000,
          maximumAge: 600000,
        }
      );
    }
  }, [setLanguage, toast]);


  // Stable callback to trigger the voice prompt check
  const triggerVoicePrompt = useCallback(() => {
    setVoiceTrigger(v => v + 1);
  }, []);

  const retryCommand = useCallback((command: string) => {
    setRetryCommandText(command);
  }, []);

  const showPriceCheck = useCallback((info: PriceCheckInfo) => {
      setPriceCheckInfo(info);
      setTimeout(() => {
          setPriceCheckInfo(null);
      }, 5000); // Hide after 5 seconds
  }, []);


  return (
    <VoiceCommandContext.Provider value={{ triggerVoicePrompt, retryCommand, showPriceCheck }}>
        <div className="relative flex min-h-dvh flex-col bg-background">
        <Header 
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => setVoiceEnabled(prev => !prev)}
            voiceStatus={voiceStatus}
            suggestedCommands={suggestedCommands}
            isCartOpen={isCartOpen}
            onCartOpenChange={setIsCartOpen}
        />
        {user && isInitialized && (
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
            />
        )}
        <ProfileCompletionChecker />
        <PriceCheckDisplay info={priceCheckInfo} />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <NotificationPermissionManager />
        <Footer />
        <BottomNavBar />
        </div>
    </VoiceCommandContext.Provider>
  );
}
