'use server';

import { initializeApp, getApps, App, applicationDefault } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config'; // Import the shared config

interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
}

// This is a global singleton to ensure we only initialize the admin app once.
let adminServices: AdminServices | null = null;

export async function getAdminServices(): Promise<AdminServices> {
  // If the services have already been initialized, return them immediately.
  if (adminServices) {
    return adminServices;
  }

  // If no apps are initialized, this is the first time.
  // If apps exist, we get the existing default app. This handles Next.js hot-reloading.
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        // Use the shared firebaseConfig to ensure project consistency
        projectId: firebaseConfig.projectId,
        // Application Default Credentials (ADC) will be used for authentication.
        // This is the standard way to authenticate on Google Cloud environments.
        credential: applicationDefault(),
    });

  // Store the initialized services in the global singleton.
  adminServices = {
    app: app,
    auth: getAuth(app),
    db: getFirestore(app),
  };

  return adminServices;
}
