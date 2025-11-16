
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

function getServiceAccount(): ServiceAccount | undefined {
  const serviceAccountString = process.env.SERVICE_ACCOUNT;
  if (!serviceAccountString) {
    console.warn(
      "SERVICE_ACCOUNT environment variable is not set. " +
      "For local development, please add the content of your service account JSON file to the .env file."
    );
    return undefined;
  }
  try {
    // The environment variable is a string, so we need to parse it as JSON.
    return JSON.parse(serviceAccountString);
  } catch (e) {
    console.error("Failed to parse SERVICE_ACCOUNT environment variable:", e);
    return undefined;
  }
}

export async function getAdminServices(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }
  
  const serviceAccount = getServiceAccount();

  if (!serviceAccount) {
    throw new Error(
      "Firebase Admin SDK credentials not found or are invalid. " +
      "Please ensure the SERVICE_ACCOUNT environment variable is correctly set in your .env file."
    );
  }

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
