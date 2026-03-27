'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
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
  const { firestore, user } = useFirebase();
  const { isAdmin } = useAdminAuth();
  const { isInitialized } = useAppStore();
  const [activeCall, setActiveCall] = useState<{ call: CallSession, chatId: string } | null>(null);
  const rtcManagerRef = useRef<WebRTCManager | null>(null);
  const callUnsubRef = useRef<Unsubscribe | null>(null);

  // Maintenance Listener
  const statusRef = useMemoFirebase(() => firestore ? doc(firestore, 'siteConfig', 'appStatus') : null, [firestore]);
  const { data: appStatus } = useDoc<any>(statusRef);
  const isMaintenanceActive = appStatus?.isMaintenance && !isAdmin;

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
              
              // If we find a chat with an active call and we are NOT the one who initiated it
              if (chat.activeCallId && chat.lastSenderId !== user.uid) {
                  // If we are already listening to this call, skip
                  if (activeCall?.call.id === chat.activeCallId) return;

                  // Cleanup old call listener if switching calls
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
                  // Call ended externally
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

  const handleAcceptCall = () => {
      // Audio stream is handled inside CallOverlay via answerCall
  };

  return (
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
      <NotificationPermissionManager />
      <Footer />
      <BottomNavBar />
      <FirestoreCounter />
    </div>
  );
}
