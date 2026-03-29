
'use client';

import { useState, useTransition, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ProfileCompletionChecker } from '@/components/profile-completion-checker';
import { NotificationPermissionManager } from '@/components/layout/notification-permission-manager';
import { useAppStore } from '@/lib/store';
import { BottomNavBar } from './bottom-nav-bar';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { FirestoreCounter } from './firestore-counter';
import { OfflineStatus } from './offline-status';
import { doc, collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { Cog, Zap, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CallOverlay } from '@/components/features/call-overlay';
import { endCall } from '@/lib/chat-service';
import type { Chat, CallSession } from '@/lib/types';
import { AnimatePresence } from 'framer-motion';
import { WebRTCManager } from '@/lib/webrtc-service';
import { VoiceCommandContext, PriceCheckInfo } from './voice-commander-context';
import { VoiceCommander } from './voice-commander';
import { useCart } from '@/lib/cart';

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
  const { firestore, user, isUserLoading } = useFirebase();
  const { isAdmin } = useAdminAuth();
  const { isInitialized, fetchInitialData } = useAppStore();
  const { cartItems } = useCart();
  const [activeCall, setActiveCall] = useState<{ call: CallSession, chatId: string } | null>(null);
  const rtcManagerRef = useRef<WebRTCManager | null>(null);
  const callUnsubRef = useRef<Unsubscribe | null>(null);

  // Voice States
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

  useEffect(() => {
      if (firestore && !isInitialized) {
          fetchInitialData(firestore, user?.uid);
      }
  }, [firestore, isInitialized, fetchInitialData, user?.uid]);

  const statusRef = useMemoFirebase(() => {
      if (!firestore || isUserLoading) return null;
      return doc(firestore, 'siteConfig', 'appStatus');
  }, [firestore, isUserLoading]);
  
  const { data: appStatus, isLoading: statusLoading } = useDoc<any>(statusRef);
  const isMaintenanceActive = !statusLoading && appStatus?.isMaintenance && !isAdmin;

  // Real-time Incoming Call Listener
  useEffect(() => {
      if (!firestore || !user) return;

      const q = query(
          collection(firestore, 'chats'),
          where('participants', 'array-contains', user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
          snapshot.docs.forEach((d) => {
              const chat = d.data() as Chat;
              if (chat.activeCallId && chat.lastSenderId !== user.uid) {
                  if (activeCall?.call.id === chat.activeCallId) return;
                  if (callUnsubRef.current) {
                      callUnsubRef.current();
                      callUnsubRef.current = null;
                  }
                  const callRef = doc(firestore, 'calls', chat.activeCallId);
                  callUnsubRef.current = onSnapshot(callRef, (snap) => {
                      const call = snap.data() as CallSession;
                      if (call && call.status !== 'ended') {
                          setActiveCall({ call, chatId: d.id });
                      } else {
                          setActiveCall(null);
                          if (rtcManagerRef.current) {
                              rtcManagerRef.current.hangup();
                              rtcManagerRef.current = null;
                          }
                      }
                  });
              } else if (!chat.activeCallId && activeCall?.chatId === d.id) {
                  setActiveCall(null);
                  if (callUnsubRef.current) {
                      callUnsubRef.current();
                      callUnsubRef.current = null;
                  }
              }
          });
      });

      return () => {
          unsubscribe();
          if (callUnsubRef.current) callUnsubRef.current();
      };
  }, [firestore, user, activeCall?.call.id, activeCall?.chatId]);

  const handleDeclineCall = async () => {
      if (firestore && activeCall) {
          await endCall(firestore, activeCall.chatId, activeCall.call.id);
          setActiveCall(null);
          if (rtcManagerRef.current) {
              rtcManagerRef.current.hangup();
              rtcManagerRef.current = null;
          }
      }
  };

  const handleAcceptCall = () => {};

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
        <div className="relative flex min-h-dvh flex-col bg-background">
        {isMaintenanceActive && <MaintenanceOverlay />}
        
        <AnimatePresence>
            {activeCall && (
                <CallOverlay 
                    key={activeCall.call.id}
                    call={activeCall.call}
                    onAccept={handleAcceptCall}
                    onDecline={handleDeclineCall}
                />
            )}
        </AnimatePresence>

        <OfflineStatus />
        <Header />
        <ProfileCompletionChecker />
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

        <NotificationPermissionManager />
        <Footer />
        <BottomNavBar />
        <FirestoreCounter />
        </div>
    </VoiceCommandContext.Provider>
  );
}
