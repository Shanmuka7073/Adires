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
import { doc } from 'firebase/firestore';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { Cog, Zap, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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

/**
 * Banner to remind users to verify their email.
 * This handles the cross-browser sync issue by allowing users to manual refresh.
 */
function EmailVerificationBanner() {
    const { user } = useFirebase();
    const { toast } = useToast();
    const [isChecking, startChecking] = useTransition();

    // Don't show if no user, user is already verified, or user is an admin
    if (!user || user.emailVerified || user.email === 'admin@gmail.com' || user.email === 'admin2@gmail.com') {
        return null;
    }

    const handleCheckStatus = () => {
        startChecking(async () => {
            try {
                // Force a reload of the user profile from Firebase servers
                await user.reload();
                if (user.emailVerified) {
                    toast({ title: "Email Verified!", description: "Thank you for securing your account." });
                    // Trigger a re-render to hide the banner
                    window.location.reload();
                } else {
                    toast({ 
                        variant: 'destructive', 
                        title: "Still Unverified", 
                        description: "Please check your email and click the verification link first." 
                    });
                }
            } catch (e: any) {
                toast({ variant: 'destructive', title: "Status Check Failed", description: e.message });
            }
        });
    };

    return (
        <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-4 shadow-md sticky top-0 z-[100]">
            <div className="flex items-center gap-2 overflow-hidden">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-[9px] font-black uppercase tracking-widest truncate">
                    Verify email to secure your business: {user.email}
                </p>
            </div>
            <Button 
                onClick={handleCheckStatus} 
                disabled={isChecking}
                variant="outline" 
                size="sm" 
                className="h-7 rounded-lg bg-white/10 border-white/20 hover:bg-white/20 text-white font-black text-[8px] uppercase px-3 shrink-0"
            >
                {isChecking ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Sync Status
            </Button>
        </div>
    );
}

export function MainLayout({ 
  children,
}: { 
  children: React.ReactNode;
}) {
  const { firestore } = useFirebase();
  const { isAdmin } = useAdminAuth();
  const { isInitialized } = useAppStore();

  const statusRef = useMemoFirebase(() => firestore ? doc(firestore, 'siteConfig', 'appStatus') : null, [firestore]);
  const { data: appStatus } = useDoc<any>(statusRef);
  const isMaintenanceActive = appStatus?.isMaintenance && !isAdmin;

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      {isMaintenanceActive && <MaintenanceOverlay />}
      <OfflineStatus />
      <EmailVerificationBanner />
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
