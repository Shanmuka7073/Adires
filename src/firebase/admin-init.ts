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
  const serviceAccountStr = process.env.SERVICE_ACCOUNT;
  if (serviceAccountStr) {
    try {
      return JSON.parse(serviceAccountStr);
    } catch (e) {
      console.error("Failed to parse SERVICE_ACCOUNT environment variable:", e);
      return undefined;
    }
  }
  
  // This is a fallback for local development if the env var isn't set,
  // allowing the user to use a local file instead.
  try {
    return require('../../../service-account.json');
  } catch (e) {
    // This is not a critical error, as the env var is the preferred method.
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
      "Firebase Admin SDK credentials not found. " +
      "Ensure the SERVICE_ACCOUNT environment variable is set " +
      "or a service-account.json file is present in the root."
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
