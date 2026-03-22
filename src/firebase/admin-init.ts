
'use server';

import { initializeApp, getApps, App, cert, type AppOptions } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * @fileOverview This file is the EXCLUSIVE entry point for the Firebase Admin SDK.
 * It handles the robust parsing of the SERVICE_ACCOUNT secret from Vercel.
 */

interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
  storage: ReturnType<typeof getStorage>;
}

let adminServices: AdminServices | null = null;

/**
 * Robustly parses the SERVICE_ACCOUNT environment variable.
 * Cleans accidental quotes or whitespace common in Vercel copy-pasting.
 */
function getAppOptions(): AppOptions {
    let serviceAccountString = process.env.SERVICE_ACCOUNT;
    
    if (!serviceAccountString) {
        throw new Error("CRITICAL: 'SERVICE_ACCOUNT' environment variable is missing. Please add it to Vercel Settings > Environment Variables.");
    }

    try {
        // CLEANUP: Remove leading/trailing whitespace
        serviceAccountString = serviceAccountString.trim();

        // CLEANUP: Remove accidental wrapping quotes (e.g., if user pasted "'{...}'")
        if ((serviceAccountString.startsWith("'") && serviceAccountString.endsWith("'")) || 
            (serviceAccountString.startsWith('"') && serviceAccountString.endsWith('"'))) {
            serviceAccountString = serviceAccountString.slice(1, -1);
        }

        // CLEANUP: Remove any trailing quote at the very end (common copy-paste error)
        if (serviceAccountString.endsWith("'") || serviceAccountString.endsWith('"')) {
            serviceAccountString = serviceAccountString.slice(0, -1);
        }

        const serviceAccount = JSON.parse(serviceAccountString);
        
        if (!serviceAccount.project_id) {
            throw new Error("The JSON is valid but seems to be the wrong file. Please ensure you are using the 'Firebase Service Account' key from Project Settings.");
        }

        return {
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id,
            storageBucket: `${serviceAccount.project_id}.appspot.com`,
        };
    } catch (e: any) {
        throw new Error(`INVALID JSON: ${e.message}. Tip: Ensure you copied the ENTIRE content of the JSON file and check for extra characters at the end in Vercel.`);
    }
}

export async function getAdminServices(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }

  try {
    const options = getAppOptions();
    const app = getApps().length ? getApps()[0] : initializeApp(options);

    adminServices = {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      storage: getStorage(app),
    };

    return adminServices;
  } catch (error: any) {
    console.error("ADMIN_INIT_FAILURE:", error.message);
    throw error; // Re-throw to be caught by the calling Server Action
  }
}
