
'use server';

import { initializeApp, getApps, App, cert, type AppOptions } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';


interface AdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
  storage: ReturnType<typeof getStorage>;
}

let adminServices: AdminServices | null = null;

function getAppOptions(): AppOptions {
    const serviceAccountString = process.env.SERVICE_ACCOUNT;
    if (!serviceAccountString) {
        console.warn("SERVICE_ACCOUNT environment variable is not set. Using Application Default Credentials. This may not work for storage operations outside of GCP.");
        // Attempt to use Application Default Credentials
        return {};
    }

    try {
        const serviceAccount = JSON.parse(serviceAccountString);
        const projectId = serviceAccount.project_id;
        
        if (!projectId) {
            throw new Error("project_id not found in service account.");
        }

        return {
            credential: cert(serviceAccount),
            projectId: projectId,
            storageBucket: `${projectId}.appspot.com`,
        };
    } catch (e: any) {
        console.error('Failed to parse SERVICE_ACCOUNT env var. Falling back to ADC.', e.message);
        return {};
    }
}

export async function getAdminServices(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }

  const appOptions = getAppOptions();

  // Initialize app if it doesn't exist.
  const app = getApps().length ? getApps()[0] : initializeApp(appOptions);

  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  adminServices = { app, auth, db, storage };
  return adminServices;
}
