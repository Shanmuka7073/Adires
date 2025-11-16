
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
  // This is a fallback for local development if the env var isn't set,
  // allowing the user to use a local file instead.
  try {
    // Correct the relative path to point to the project root from src/firebase
    return require('../../service-account.json');
  } catch (e) {
    // This is not a critical error if the file doesn't exist,
    // as it's a fallback mechanism.
    console.warn("Could not find 'service-account.json' in the project root. This is optional for local development if another credential method is used.");
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
      "For local development, please place a 'service-account.json' file in the project root."
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
