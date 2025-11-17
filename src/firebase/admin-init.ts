'use server';

import { initializeApp, getApps, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
}

let adminServices: AdminServices | null = null;

export async function getAdminServices(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }

  // Ensure the SERVICE_ACCOUNT environment variable is set.
  if (!process.env.SERVICE_ACCOUNT) {
    throw new Error('The SERVICE_ACCOUNT environment variable is not set. Please add it to your environment variables.');
  }

  try {
    // Correctly parse the JSON string from the environment variable.
    const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT) as ServiceAccount;

    // Initialize the app if it hasn't been already.
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          projectId: firebaseConfig.projectId,
          credential: cert(serviceAccount),
        });

    adminServices = {
      app: app,
      auth: getAuth(app),
      db: getFirestore(app),
    };

    return adminServices;

  } catch (error: any) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    // Provide a more informative error if parsing fails
    if (error instanceof SyntaxError) {
        throw new Error("Failed to parse SERVICE_ACCOUNT JSON. Please ensure it's a valid, single-line JSON string.");
    }
    throw error;
  }
}
