'use server';

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
 * Provides a hardened, safely-parsed configuration for the Firebase Admin SDK.
 * This function is critical for ensuring server-side stability.
 */
function getAdminAppOptions(): AppOptions {
  const serviceAccountString = process.env.SERVICE_ACCOUNT;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!serviceAccountString) {
    // If no service account is provided, fall back to Application Default Credentials.
    // This is useful for environments like Google Cloud Run and Vercel.
    console.warn('SERVICE_ACCOUNT not found. Falling back to Application Default Credentials.');
    if (!projectId) {
      throw new Error('Firebase Admin initialization failed: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set.');
    }
    return { projectId, storageBucket: `${projectId}.appspot.com` };
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);

    // The private_key field often has escaped newlines (\n) when set as an environment variable.
    // JSON.parse handles this, but some systems might double-escape. This ensures it's correct.
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    return {
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
      storageBucket: `${serviceAccount.project_id}.appspot.com`,
    };
  } catch (error: any) {
    // A failure to parse the service account is a critical, fatal error.
    // Throwing an error here stops the application from starting in a broken state,
    // preventing confusing client-side hydration errors.
    throw new Error(
      `Failed to parse SERVICE_ACCOUNT JSON: ${error.message}. Check your environment variables.`
    );
  }
}

/**
 * Initializes and returns the Firebase Admin services, ensuring it only happens once.
 * This function is the single entry point for accessing server-side Firebase services.
 */
export async function getAdminServices(): Promise<AdminServices> {
  if (typeof window !== 'undefined') {
    throw new Error('getAdminServices() cannot be called on the client.');
  }

  if (adminServices) {
    return adminServices;
  }

  try {
    const options = getAdminAppOptions();
    const app = getApps().length === 0 ? initializeApp(options) : getApps()[0];

    adminServices = {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      storage: getStorage(app),
      messaging: getMessaging(app),
    };
    
    return adminServices;
  } catch (error: any) {
    // This catch block will now provide a clear, top-level error message if initialization fails.
    console.error('FATAL: Firebase Admin SDK initialization failed.', error);
    throw new Error(`The server failed to initialize the Admin SDK: ${error.message}`);
  }
}
