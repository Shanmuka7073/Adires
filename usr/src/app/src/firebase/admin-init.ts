
'use server';

import { initializeApp, getApps, App, applicationDefault, cert } from 'firebase-admin/app';
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

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: applicationDefault(),
      });

  adminServices = {
    app: app,
    auth: getAuth(app),
    db: getFirestore(app),
  };

  return adminServices;
}
