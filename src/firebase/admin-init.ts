
'use server';

import { initializeApp, getApps, App, cert, type AppOptions } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * @fileOverview This file is the EXCLUSIVE entry point for the Firebase Admin SDK.
 * It is marked with 'use server' to prevent any part of this logic from being bundled 
 * into the client-side code.
 */

interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
  storage: ReturnType<typeof getStorage>;
}

// Global singleton to prevent multiple initializations during Next.js HMR.
let adminServices: AdminServices | null = null;

/**
 * Generates AppOptions from environment variables.
 * SERVICE_ACCOUNT should be a stringified JSON object in Vercel.
 */
function getAppOptions(): AppOptions {
    const serviceAccountString = process.env.SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
        // Fallback for local development or when secret is missing
        console.warn("SERVICE_ACCOUNT not found. Admin operations will run in restricted mode.");
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        };
    }

    try {
        // ROBUST PARSING: Trim whitespace and remove accidental leading/trailing quotes
        // This handles cases where the user might have pasted "'{...}'" instead of "{...}"
        const cleanedString = serviceAccountString.trim().replace(/^['"]|['"]$/g, '');
        const serviceAccount = JSON.parse(cleanedString);
        
        return {
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id,
            storageBucket: `${serviceAccount.project_id}.appspot.com`,
        };
    } catch (e: any) {
        console.error('Failed to parse SERVICE_ACCOUNT secret:', e.message);
        return {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        };
    }
}

/**
 * The only function that should be used by Server Actions to access Admin features.
 */
export async function getAdminServices(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }

  const options = getAppOptions();
  const app = getApps().length ? getApps()[0] : initializeApp(options);

  adminServices = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };

  return adminServices;
}
