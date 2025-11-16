'use server';

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';
import 'dotenv/config';

interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
}

let adminServices: AdminServices | null = null;

function getServiceAccount() {
  if (process.env.SERVICE_ACCOUNT) {
    return JSON.parse(process.env.SERVICE_ACCOUNT);
  }
  // This is for local development only
  try {
    return require('../../../service-account.json');
  } catch (e) {
    console.warn("Could not find service-account.json. Admin SDK will not be initialized for local development.");
    return null;
  }
}

export async function getAdminServices(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }
  
  const serviceAccount = getServiceAccount();

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        projectId: firebaseConfig.projectId,
        credential: serviceAccount ? cert(serviceAccount) : undefined,
      });

  adminServices = {
    app: app,
    auth: getAuth(app),
    db: getFirestore(app),
  };

  return adminServices;
}