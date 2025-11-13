
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;

/**
 * Ensures the Firebase Admin SDK is initialized and returns the auth and firestore services.
 * This is a robust way to handle initialization in serverless environments.
 */
export function getAdminServices() {
  if (adminApp) {
    return {
      auth: getAuth(adminApp),
      db: getFirestore(adminApp),
    };
  }

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Server-side Firebase services are unavailable.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);

    if (getApps().length) {
        adminApp = getApps()[0];
    } else {
        adminApp = initializeApp({
            credential: cert(serviceAccount),
        });
    }

    return {
        auth: getAuth(adminApp),
        db: getFirestore(adminApp),
    };
  } catch (e: any) {
    console.error('Failed to initialize Firebase Admin SDK:', e.message);
    throw new Error('Could not initialize Firebase Admin SDK. ' + e.message);
  }
}
