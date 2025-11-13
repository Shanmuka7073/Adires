
'use server';

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Define a type for the services to ensure consistency
interface AdminServices {
  app: App;
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
}

// A global variable to hold the initialized services, acting as a singleton.
let adminServices: AdminServices | null = null;

/**
 * Initializes the Firebase Admin SDK if not already initialized.
 * This function uses a singleton pattern to ensure that initialization
 * happens only once per server instance.
 * @returns An object containing the initialized Firebase Admin app, Auth, and Firestore services.
 */
export function getAdminServices(): AdminServices {
  if (adminServices) {
    return adminServices;
  }

  // Ensure environment variables are set. This is a critical check.
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL;
  // The private key needs to have its newlines properly escaped when stored in an env var.
  const privateKey = process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin SDK environment variables are not set. Please check your .env file.');
  }

  try {
    const apps = getApps();
    const adminApp = apps.find(app => app.name === 'firebase-admin') || initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    }, 'firebase-admin');

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
