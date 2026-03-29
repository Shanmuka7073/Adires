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

/**
 * HARDENED CREDENTIAL LOADER
 * Resolves "Could not load default credentials" by ensuring the SERVICE_ACCOUNT
 * environment variable is correctly parsed even if it contains escaped characters.
 */
function getAppOptions(): AppOptions {
    let serviceAccountString = process.env.SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
        console.warn("ADMIN_SDK: SERVICE_ACCOUNT missing. Falling back to basic project config. Some features may fail.");
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`,
        };
    }

    try {
        // Handle cases where the secret might be wrapped in extra quotes from Vercel/Terminal
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
