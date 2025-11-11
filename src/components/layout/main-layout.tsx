

'use client';

import { useState, createContext, useContext, useCallback, useEffect } from 'react';
import { useCart } from '@/lib/cart';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { VoiceCommander } from '@/components/layout/voice-commander';
import { ProfileCompletionChecker } from '@/components/profile-completion-checker';
import { NotificationPermissionManager } from '@/components/layout/notification-permission-manager';
import { useInitializeApp, useAppStore } from '@/lib/store';
import { getLanguageForLocation } from '@/lib/location-service';
import { useToast } from '@/hooks/use-toast';

// Create a context to provide the trigger function
const VoiceCommandContext = createContext<{ triggerVoicePrompt: () => void } | undefined>(undefined);

export function useVoiceCommander() {
    const context = useContext(VoiceCommandContext);
    if (!context) {
        throw new Error('useVoiceCommander must be used within a MainLayout');
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
  
  // Initialize the app data and get the loading status from the global store
  const isAppLoading = useInitializeApp();
  const { setLanguage } = useAppStore();

  // State to trigger re-evaluation in VoiceCommander
  const [voiceTrigger, setVoiceTrigger] = useState(0);

  // --- Location-based language detection ---
  useEffect(() => {
    // Only run this check if no language has been manually set by the user.
    const savedLanguage = localStorage.getItem('app-language');
    if (savedLanguage) {
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const detectedLang = getLanguageForLocation(latitude, longitude);
          // Only set the language if it hasn't been set by the user yet.
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
          maximumAge: 600000, // Use a cached position up to 10 minutes old
        }
      );
    }
  }, [setLanguage, toast]); // Dependencies ensure this runs only once with stable functions.


  // Stable callback to trigger the voice prompt check
  const triggerVoicePrompt = useCallback(() => {
    setVoiceTrigger(v => v + 1);
  }, []);

  return (
    <VoiceCommandContext.Provider value={{ triggerVoicePrompt }}>
        <div className="relative flex min-h-dvh flex-col bg-background">
        <Header 
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => setVoiceEnabled(prev => !prev)}
            voiceStatus={voiceStatus}
            suggestedCommands={suggestedCommands}
            isCartOpen={isCartOpen}
            onCartOpenChange={setIsCartOpen}
        />
        {!isAppLoading && (
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
            />
        )}
        <ProfileCompletionChecker />
        <main className="flex-1 pb-10">{children}</main>
        <NotificationPermissionManager />
        <Footer />
        </div>
    </VoiceCommandContext.Provider>
  );
}
