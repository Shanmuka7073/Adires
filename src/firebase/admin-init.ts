
'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
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

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp();

  const auth = getAuth(app);
  const db = getFirestore(app);

  adminServices = { app, auth, db };
  return adminServices;
}
