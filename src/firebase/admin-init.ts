
import { initializeApp, getApps, App, cert, type AppOptions } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
  storage: ReturnType<typeof getStorage>;
  messaging: Messaging;
}

let adminServices: AdminServices | null = null;

function getAppOptions(): AppOptions {
    let serviceAccountString = process.env.SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`,
        };
    }

    try {
        serviceAccountString = serviceAccountString.trim();
        if (serviceAccountString.startsWith('"') && serviceAccountString.endsWith('"')) {
            serviceAccountString = serviceAccountString.slice(1, -1);
        }

        const serviceAccount = JSON.parse(serviceAccountString);
        
        return {
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id,
            storageBucket: `${serviceAccount.project_id}.appspot.com`,
        };
    } catch (e: any) {
        console.error("CRITICAL: Failed to parse SERVICE_ACCOUNT secret:", e.message);
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        };
    }
}

export function getAdminServices(): AdminServices {
  if (typeof window !== 'undefined') {
    throw new Error('getAdminServices can only be called on the server.');
  }

  if (adminServices) {
    return adminServices;
  }

  const options = getAppOptions();
  const app = getApps().length ? getApps()[0] : initializeApp(options);

  adminServices = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
    messaging: getMessaging(app),
  };

  return adminServices;
}
