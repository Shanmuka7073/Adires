
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
}
