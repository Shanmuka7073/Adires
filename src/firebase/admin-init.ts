
import { initializeApp, getApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null;

let app: App;

// Singleton pattern to initialize Firebase Admin SDK
if (getApps().length === 0) {
  if (serviceAccount) {
    // For Vercel or environments where service account JSON is in an env var
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // For local development with `gcloud auth application-default login`
    // or Cloud Run/Functions with default credentials
    app = initializeApp();
  }
} else {
  app = getApp();
}

export const firestore = getFirestore(app);
export const auth = getAuth(app);
