'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

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
    throw new Error(`Firebase Admin SDK initialization failed: ${error.message}`);
  }
}
