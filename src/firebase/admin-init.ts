
'use server';

import { initializeApp, getApps, App, type AppOptions } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
}

let adminServices: AdminServices | null = null;

function getAppOptions(): AppOptions {
    if (process.env.SERVICE_ACCOUNT) {
        try {
            const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);
            return {
                credential: {
                    clientEmail: serviceAccount.client_email,
                    privateKey: serviceAccount.private_key,
                    projectId: serviceAccount.project_id,
                },
                projectId: serviceAccount.project_id,
            };
        } catch (e) {
            console.error('Failed to parse SERVICE_ACCOUNT env var:', e);
        }
    }
    // Fallback for local development or if env var is missing
    return {};
}

export async function getAdminServices(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }

  const appOptions = getAppOptions();

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp(appOptions);

  const auth = getAuth(app);
  const db = getFirestore(app);

  adminServices = { app, auth, db };
  return adminServices;
}
