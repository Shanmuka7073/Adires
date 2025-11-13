
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let adminApp: App | null = null;

const getAdminApp = (): App => {
    if (adminApp) {
        return adminApp;
    }
    
    if (getApps().length > 0) {
        adminApp = getApps()[0];
        return adminApp;
    }

    if (!serviceAccountString) {
        throw new Error('The FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. The System Status page cannot function without it.');
    }

    try {
        const serviceAccount = JSON.parse(serviceAccountString);
        adminApp = initializeApp({
            credential: cert(serviceAccount),
        });
        return adminApp;
    } catch (error: any) {
        console.error("Failed to parse or use service account credentials:", error.message);
        throw new Error("Could not initialize Firebase Admin SDK. Please check your service account credentials.");
    }
};

export const initializeAdminApp = () => {
    const app = getAdminApp();
    return {
        app,
        auth: getAuth(app),
        db: getFirestore(app)
    };
};
