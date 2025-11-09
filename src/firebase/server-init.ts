
import { initializeApp, getApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Initializes the Firebase Admin SDK, reusing the existing app instance if available.
 * This function is intended for server-side use only. It relies on default application
 * credentials, which are automatically available in Google Cloud environments (like App Hosting)
 * or can be set up locally by logging in with the `gcloud` CLI.
 *
 * To set up locally:
 * 1. `gcloud auth application-default login`
 * 2. Run your Next.js dev server.
 *
 * @returns An object containing the initialized Firebase Admin app, Firestore, and Auth services.
 */
export function initServerApp() {
  // Check if an app is already initialized to prevent re-initialization errors.
  if (getApps().length > 0) {
    const existingApp = getApp();
    return {
      firebaseAdminApp: existingApp,
      firestore: getFirestore(existingApp),
      auth: getAuth(existingApp),
    };
  }

  // initializeApp() will automatically use the Application Default Credentials
  // in a server environment.
  const app = initializeApp();

  return {
    firebaseAdminApp: app,
    firestore: getFirestore(app),
    auth: getAuth(app),
  };
}
