
'use server';

import { initializeApp, getApps, App, cert, type AppOptions } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
}

// This is a global singleton to ensure we only initialize the admin app once.
let adminServices: AdminServices | null = null;

/**
 * Derives the Firebase Admin AppOptions from environment variables.
 * Prioritizes the SERVICE_ACCOUNT secret for full production authority.
 */
function getAppOptions(): AppOptions {
    const serviceAccountString = process.env.SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        };
    }

    try {
        const serviceAccount = JSON.parse(serviceAccountString);
        return {
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id,
        };
    } catch (e: any) {
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        };
    }
}

export async function getAdminServices(): Promise<AdminServices> {
  // If the services have already been initialized, return them immediately.
  if (adminServices) {
    return adminServices;
  }

  const appOptions = getAppOptions();

  // If no apps are initialized, this is the first time.
  // If apps exist, we get the existing default app. This handles Next.js hot-reloading.
  const app = getApps().length
    ? getApps()[0]
    : initializeApp(appOptions);

  // Store the initialized services in the global singleton.
  adminServices = {
    app: app,
    auth: getAuth(app),
    db: getFirestore(app),
  };

  return adminServices;
}
