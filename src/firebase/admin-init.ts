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

let adminServices: AdminServices | null = null;

export async function getAdminServices(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }

  // Use the shared firebaseConfig to ensure project consistency
  const config = {
    credential: applicationDefault(),
    projectId: firebaseConfig.projectId,
  };

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
    const adminApp = initializeApp(config);
    
    adminServices = {
      app: adminApp,
      auth: getAuth(adminApp),
      db: getFirestore(adminApp),
    };

    return adminServices;

  } catch (error: any) {
    console.error('CRITICAL: Firebase Admin SDK initialization failed.', error);
    throw new Error(`Firebase Admin SDK initialization failed: ${error.message}`);
  }
}
