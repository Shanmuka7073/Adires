
<<<<<<< HEAD

'use client';

import { useState, createContext, useContext, useCallback, useEffect } from 'react';
=======
'use client';

import { useState, createContext, useContext, useCallback } from 'react';
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
import { useCart } from '@/lib/cart';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { VoiceCommander } from '@/components/layout/voice-commander';
import { ProfileCompletionChecker } from '@/components/profile-completion-checker';
import { NotificationPermissionManager } from '@/components/layout/notification-permission-manager';
<<<<<<< HEAD
import { useInitializeApp, useAppStore } from '@/lib/store';
import { getLanguageForLocation } from '@/lib/location-service';
import { useToast } from '@/hooks/use-toast';

// Create a context to provide the trigger function
const VoiceCommandContext = createContext<{ triggerVoicePrompt: () => void, retryCommand?: (command: string) => void; } | undefined>(undefined);
=======

// Create a context to provide the trigger function
const VoiceCommandContext = createContext<{ triggerVoicePrompt: () => void } | undefined>(undefined);
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584

export function useVoiceCommander() {
    const context = useContext(VoiceCommandContext);
    if (!context) {
        throw new Error('useVoiceCommander must be used within a MainLayout');
    }
    return context;
}

<<<<<<< HEAD
export function MainLayout({ 
  children,
}: { 
  children: React.ReactNode;
}) {
=======
export function MainLayout({ children }: { children: React.ReactNode }) {
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Click the mic to start listening.');
  const [suggestedCommands, setSuggestedCommands] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { cartItems } = useCart();
<<<<<<< HEAD
  const { toast } = useToast();
  
  // Initialize the app data and get the loading status from the global store
  const isAppLoading = useInitializeApp();
  const { setLanguage } = useAppStore();

  // State to trigger re-evaluation in VoiceCommander
  const [voiceTrigger, setVoiceTrigger] = useState(0);
  const [retryCommandText, setRetryCommandText] = useState<string | null>(null);

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


=======

  // State to trigger re-evaluation in VoiceCommander
  const [voiceTrigger, setVoiceTrigger] = useState(0);
  
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
  // Stable callback to trigger the voice prompt check
  const triggerVoicePrompt = useCallback(() => {
    setVoiceTrigger(v => v + 1);
  }, []);

<<<<<<< HEAD
  const retryCommand = useCallback((command: string) => {
    setRetryCommandText(command);
  }, []);


  return (
    <VoiceCommandContext.Provider value={{ triggerVoicePrompt, retryCommand }}>
=======
  return (
    <VoiceCommandContext.Provider value={{ triggerVoicePrompt }}>
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
        <div className="relative flex min-h-dvh flex-col bg-background">
        <Header 
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => setVoiceEnabled(prev => !prev)}
            voiceStatus={voiceStatus}
            suggestedCommands={suggestedCommands}
            isCartOpen={isCartOpen}
            onCartOpenChange={setIsCartOpen}
        />
<<<<<<< HEAD
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
                retryCommandText={retryCommandText}
                onRetryHandled={() => setRetryCommandText(null)}
            />
        )}
=======
        <VoiceCommander 
            enabled={voiceEnabled} 
            onStatusUpdate={setVoiceStatus}
            onSuggestions={setSuggestedCommands}
            onOpenCart={() => setIsCartOpen(true)}
            onCloseCart={() => setIsCartOpen(false)}
            isCartOpen={isCartOpen}
            cartItems={cartItems}
            voiceTrigger={voiceTrigger}
        />
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
        <ProfileCompletionChecker />
        <main className="flex-1 pb-10">{children}</main>
        <NotificationPermissionManager />
        <Footer />
        </div>
    </VoiceCommandContext.Provider>
  );
}
<<<<<<< HEAD
=======

    
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
