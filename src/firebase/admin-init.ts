
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;

/**
 * Ensures the Firebase Admin SDK is initialized and returns services.
 * This version uses individual environment variables to avoid JSON parsing issues.
 */
export function getAdminServices(): { auth: Auth; db: Firestore } {
  if (adminApp) {
    return {
      auth: getAuth(adminApp),
      db: getFirestore(adminApp),
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // The private key needs to have its escaped newlines replaced with actual newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Required Firebase Admin environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are not set.'
    );
  }

  const serviceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };

  try {
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
    console.error('Firebase Admin Init Failed:', e.message);
    throw new Error('Could not initialize Firebase Admin SDK. ' + e.message);
  }
}
