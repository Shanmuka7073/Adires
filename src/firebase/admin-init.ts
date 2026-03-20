'use server';

import { initializeApp, getApps, App, cert, type AppOptions } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
  storage: ReturnType<typeof getStorage>;
}

let adminServices: AdminServices | null = null;

/**
 * Derives the Firebase Admin AppOptions from environment variables.
 * Prioritizes the SERVICE_ACCOUNT secret for full production authority.
 */
function getAppOptions(): AppOptions {
    const serviceAccountString = process.env.SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
        console.warn("SERVICE_ACCOUNT environment variable is not set. Falling back to basic project ID. Storage operations may fail.");
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        };
    }

    try {
        const serviceAccount = JSON.parse(serviceAccountString);
        const projectId = serviceAccount.project_id;
        
        if (!projectId) {
            throw new Error("project_id not found in service account.");
        }

        return {
            credential: cert(serviceAccount),
            projectId: projectId,
            storageBucket: `${projectId}.appspot.com`,
        };
    } catch (e: any) {
        console.error('Failed to parse SERVICE_ACCOUNT env var. Falling back to basic project configuration.', e.message);
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        };
    }
}

/**
 * Returns the initialized Firebase Admin services.
 * Implements a singleton pattern to ensure consistency across Server Actions.
 */
export async function getAdminServices(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }

  const appOptions = getAppOptions();

  // Initialize app if it doesn't exist. Handles Next.js development HMR.
  const app = getApps().length ? getApps()[0] : initializeApp(appOptions);

  adminServices = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };

  return adminServices;
}
