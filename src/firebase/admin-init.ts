
import { initializeApp, getApps, cert, App, getApp } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const ADMIN_APP_NAME = 'firebase-admin-app';

/**
 * Ensures the Firebase Admin SDK is initialized and returns the auth and firestore services.
 * This function caches the initialized app for reuse.
 */
export function getAdminServices(): { auth: Auth; db: Firestore } {
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
  
  // Get or initialize the uniquely named admin app
  let adminApp: App;
  if (!getApps().some(app => app.name === ADMIN_APP_NAME)) {
    adminApp = initializeApp({
      credential: cert(serviceAccount),
    }, ADMIN_APP_NAME);
  } else {
    adminApp = getApp(ADMIN_APP_NAME);
  }

  return {
    auth: getAuth(adminApp),
    db: getFirestore(adminApp),
  };
}
