
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// A "singleton" variable to hold the initialized app.
// This prevents re-initializing on every serverless function cold start.
let adminApp: App | null = null;

/**
 * Ensures the Firebase Admin SDK is initialized and returns the auth and firestore services.
 * This function caches the initialized app for reuse.
 */
export function getAdminServices(): { auth: Auth | null; db: Firestore | null } {
  // If the app is already initialized, return the services immediately.
  if (adminApp) {
    return {
      auth: getAuth(adminApp),
      db: getFirestore(adminApp),
    };
  }

  // Check for environment variables.
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      'Firebase Admin environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are not set. Server-side Firebase services will be unavailable.'
    );
    return { auth: null, db: null };
  }

  try {
    const serviceAccount = {
      projectId,
      clientEmail,
      privateKey,
    };

    // Initialize the app or get the existing one.
    if (getApps().length) {
      adminApp = getApps()[0];
    } else {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    }

    // Return the services.
    return {
      auth: getAuth(adminApp),
      db: getFirestore(adminApp),
    };
  } catch (e: any) {
    console.error(
      '[FATAL] Firebase Admin Init Failed:',
      e.message
    );
    return { auth: null, db: null };
  }
}
