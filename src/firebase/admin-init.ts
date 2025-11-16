
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
  try {
    // Load the service account key from the same directory.
    return require('./service-account.json');
  } catch (e) {
    // This is not a critical error if the file doesn't exist,
    // as it's a fallback mechanism.
    console.warn("Could not find 'service-account.json' in 'src/firebase'. This is required for local admin operations.");
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
      "For local development, please place a 'service-account.json' file in the 'src/firebase' directory."
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
