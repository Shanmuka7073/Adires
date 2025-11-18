
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let app;

if (!global._firebaseApp) {
  app = initializeApp({
    credential: applicationDefault(),
  });
  global._firebaseApp = app;
} else {
  app = global._firebaseApp;
}

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
