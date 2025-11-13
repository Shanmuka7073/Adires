
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let adminApp: App;
let initializedDb: ReturnType<typeof getFirestore> | null = null;
let initializedAuth: ReturnType<typeof getAuth> | null = null;

if (serviceAccountString) {
  if (!getApps().length) {
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (e) {
      console.error('Failed to initialize Firebase Admin SDK:', e);
      // Fallback to a default app if initialization fails but an app exists.
      adminApp = getApps()[0];
    }
  } else {
    adminApp = getApps()[0];
  }

  initializedDb = getFirestore(adminApp);
  initializedAuth = getAuth(adminApp);
} else {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY is not set. Server-side Firebase services will not be available.");
}


export const db = initializedDb;
export const auth = initializedAuth;
