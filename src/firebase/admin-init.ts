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
 * Resolves "Internal Server Error" by ensuring the SERVICE_ACCOUNT
 * environment variable is correctly parsed and validated.
 */
function getAppOptions(): AppOptions {
    let serviceAccountString = process.env.SERVICE_ACCOUNT;
    const fallbackBucket = `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'adires'}.appspot.com`;
    
    if (!serviceAccountString) {
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: fallbackBucket,
        };
    }

    try {
        // Handle cases where the secret might be wrapped in extra quotes
        serviceAccountString = serviceAccountString.trim();
        if (serviceAccountString.startsWith('"') && serviceAccountString.endsWith('"')) {
            serviceAccountString = serviceAccountString.slice(1, -1);
        }

        const serviceAccount = JSON.parse(serviceAccountString);
        
        // Final validation of required service account fields
        if (!serviceAccount.project_id || !serviceAccount.private_key) {
            throw new Error("Missing critical fields in service account JSON.");
        }

        return {
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id,
            storageBucket: `${serviceAccount.project_id}.appspot.com`,
        };
    } catch (e: any) {
        console.error("ADMIN_SDK_INIT_ERROR:", e.message);
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: fallbackBucket,
        };
    }
}

/**
 * Returns the initialized Firebase Admin services.
 * Now Async to ensure safe initialization across all server contexts.
 */
export async function getAdminServices(): Promise<AdminServices> {
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
