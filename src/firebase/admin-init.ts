
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// This is the standard way to initialize the Admin SDK.
// It will automatically use Google Application Default Credentials.
const adminApp = getApps().find(app => app.name === 'admin') || initializeApp({
  // By not providing a credential, the SDK will use Google Application Default Credentials.
}, 'admin');

const firestore = getFirestore(adminApp);

export { firestore, adminApp };
