
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ProfileCompletionChecker } from '@/components/profile-completion-checker';
import { NotificationPermissionManager } from '@/components/layout/notification-permission-manager';
import { useAppStore } from '@/lib/store';
import { BottomNavBar } from './bottom-nav-bar';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { FirestoreCounter } from './firestore-counter';
import { OfflineStatus } from './offline-status';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { Cog, Zap, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CallOverlay } from '@/components/features/call-overlay';
import { endCall } from '@/lib/chat-service';
import type { Chat } from '@/lib/types';

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
  const [activeCall, setActiveCall] = useState<{ call: any, chatId: string } | null>(null);

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
          snapshot.docs.forEach(doc => {
              const chat = doc.data() as Chat;
              // Check if someone else is calling us
              if (chat.activeCall && chat.activeCall.callerId !== user.uid && chat.activeCall.status === 'ringing') {
                  setActiveCall({ call: chat.activeCall, chatId: doc.id });
              } else if (activeCall?.chatId === doc.id && (!chat.activeCall || chat.activeCall.status !== 'ringing')) {
                  // Call ended remotely
                  setActiveCall(null);
              }
          });
      });

      return () => unsubscribe();
  }, [firestore, user, activeCall?.chatId]);

  const handleDeclineCall = async () => {
      if (firestore && activeCall) {
          await endCall(firestore, activeCall.chatId);
          setActiveCall(null);
      }
  };

  const handleAcceptCall = () => {
      // In a real app, this would route to a /call/[callId] page
      // For this step, we just acknowledge and dismiss the overlay
      handleDeclineCall();
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      {isMaintenanceActive && <MaintenanceOverlay />}
      
      <AnimatePresence>
          {activeCall && (
              <CallOverlay 
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
