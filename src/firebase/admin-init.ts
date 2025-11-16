
'use server';

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// Define a type for the services to ensure consistency
interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
}

// A global variable to hold the initialized services, acting as a singleton.
let adminServices: AdminServices | null = null;

/**
 * Initializes the Firebase Admin SDK if not already initialized.
 * This function uses a singleton pattern to ensure that initialization
 * happens only once per server instance.
 * @returns A promise that resolves to an object containing the initialized Firebase Admin app, Auth, and Firestore services.
 */
export async function getAdminServices(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }

  // In a Google Cloud environment like Firebase App Hosting, initializeApp()
  // with no arguments will automatically use the service account credentials.
  // For local development, you might need to provide a service account file.
  if (getApps().length > 0) {
      const existingApp = getApps()[0];
      adminServices = {
          app: existingApp,
          auth: getAuth(existingApp),
          db: getFirestore(existingApp),
      };
      return adminServices;
  }

  try {
    const adminApp = initializeApp();
    
    adminServices = {
      app: adminApp,
      auth: getAuth(adminApp),
      db: getFirestore(adminApp),
    };

    return adminServices;

  } catch (error: any) {
    console.error('CRITICAL: Firebase Admin SDK initialization failed.', error);
    // Throwing an error here is important because if the Admin SDK fails,
    // many server-side features of the app will not work.
    throw new Error(`Firebase Admin SDK initialization failed: ${error.message}`);
  }
}
