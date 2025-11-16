/**
 * @fileoverview This file exports the client-side Firebase configuration object.
 * It is used by the client-side initialization logic in `/src/firebase/index.ts`.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'monospace-10.firebaseapp.com',
  projectId: 'monospace-10',
  storageBucket: 'monospace-10.appspot.com',
  messagingSenderId: '1098358237307',
  appId: '1:1098358237307:web:e69d3e875796f23a63d958',
};
