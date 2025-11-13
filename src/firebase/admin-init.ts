
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// IMPORTANT: This service account is for DEMONSTRATION PURPOSES ONLY.
// In a real production application, you should manage your service account
// keys securely, for example, by using Google Cloud Secret Manager.
// DO NOT commit your service account keys to your version control.
const serviceAccount = {
  "projectId": "studio-9070259337-c267a",
  "privateKey": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCp/lH9t8f4J2oN\\n5f6b2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b2Z2c2F3e3e2b\\n2Z2c2F3e3e2b2Z2c2F3e3gSjAgEAAoIBAQCl\\n-----END PRIVATE KEY-----\\n",
  "clientEmail": "firebase-adminsdk-q0p8g@studio-9070259337-c267a.iam.gserviceaccount.com",
  "clientId": "116542475471413809053",
  "authUri": "https://accounts.google.com/o/oauth2/auth",
  "tokenUri": "https://oauth2.googleapis.com/token",
  "authProviderX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
  "clientX509CertUrl": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-q0p8g%40studio-9070259337-c267a.iam.gserviceaccount.com"
};


const getAdminApp = (): App => {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: cert(serviceAccount),
  });
};

export const initializeAdminApp = () => {
    const app = getAdminApp();
    return {
        app,
        auth: getAuth(app),
        db: getFirestore(app)
    };
};
