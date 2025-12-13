
'use server';

import { initializeApp, getApps, App, cert, type AppOptions } from 'firebase-admin/app';
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
                credential: cert({
                    clientEmail: serviceAccount.client_email,
                    privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
                    projectId: serviceAccount.project_id,
                }),
                projectId: serviceAccount.project_id,
            };
        } catch (e) {
            console.error('Failed to parse SERVICE_ACCOUNT env var:', e);
        }
    }
    // Fallback for environments with Application Default Credentials
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
