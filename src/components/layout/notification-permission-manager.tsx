
'use client';

import { useEffect } from 'react';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getFirebaseConfig } from '@/app/actions';

/**
 * Manages Push Notification permissions and FCM token lifecycle.
 * Optimized to use the existing PWA Service Worker registration.
 */
export function NotificationPermissionManager() {
  const { firebaseApp, user, firestore } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    const requestPermission = async () => {
      if (!firebaseApp || !user || !firestore) return;

      const messagingSupported = await isSupported();
      if (!messagingSupported) {
        console.warn('FCM: Not supported in this browser.');
        return;
      }

      // 1. Wait for Service Worker to be fully active
      if (!('serviceWorker' in navigator)) return;
      const registration = await navigator.serviceWorker.ready;

      const messaging = getMessaging(firebaseApp);

      if (Notification.permission === 'granted') {
        try {
          // Fetch the VAPID key dynamically from the server to ensure we have the latest production key
          const config = await getFirebaseConfig();
          const vapidKey = config?.vapidKey;
          
          if (!vapidKey) {
              console.warn("FCM: VAPID Key is missing. Push notifications will not work. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY to Vercel.");
              return;
          }

          const currentToken = await getToken(messaging, {
            vapidKey: vapidKey,
            serviceWorkerRegistration: registration,
          });

          if (currentToken) {
            const userDocRef = doc(firestore, 'users', user.uid);
            await updateDoc(userDocRef, { fcmToken: currentToken });
            console.log('FCM: Token synchronized with user profile.');
          }
        } catch (err: any) {
          console.error('FCM: Token retrieval failed:', err);
          if (err.code === 'messaging/permission-blocked') {
              toast({
                variant: 'destructive',
                title: 'Notifications Blocked',
                description: 'Please enable notifications in your browser settings to receive order updates.',
              });
          }
        }
      }
    };

    requestPermission();
  }, [firebaseApp, user, firestore, toast]);

  return null;
}
