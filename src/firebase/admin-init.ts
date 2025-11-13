
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let adminApp: App | null = null;
let initializedDb = null;
let initializedAuth = null;

if (serviceAccountString) {
  if (!getApps().length) {
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized successfully.');
    } catch (e) {
      console.error('Failed to initialize Firebase Admin SDK:', e);
    }
  } else {
    adminApp = getApps()[0];
  }
}

if (adminApp) {
  initializedDb = getFirestore(adminApp);
  initializedAuth = getAuth(adminApp);
}

export const db = initializedDb;
export const auth = initializedAuth;
