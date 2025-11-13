
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// A "singleton" variable to hold the initialized app.
// This prevents re-initializing on every serverless function cold start.
let adminApp: App | null = null;

/**
 * Ensures the Firebase Admin SDK is initialized and returns the auth and firestore services.
 * This function caches the initialized app for reuse.
 */
export function getAdminServices(): { auth: Auth; db: Firestore } {
  // If the app is already initialized, return the services immediately.
  if (adminApp) {
    return {
      auth: getAuth(adminApp),
      db: getFirestore(adminApp),
    };
  }

  // Get the service account string from environment variables.
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Server-side Firebase services are unavailable.'
    );
  }

  let cleanedString = serviceAccountString;

  try {
    // --- String Cleaning Logic ---
    // This attempts to fix common environment variable escaping issues.

    // 1. If the string is wrapped in an extra set of quotes (e.g., "{\"key\":\"...\"}"), remove them.
    if (cleanedString.startsWith('"') && cleanedString.endsWith('"')) {
      cleanedString = cleanedString.substring(1, cleanedString.length - 1);
    }

    // 2. Un-escape characters that are often double-escaped in env vars.
    // Replace literal "\\n" with actual newline "\n"
    cleanedString = cleanedString.replace(/\\n/g, '\n');
    // Replace literal '\"' with actual quote '"'
    cleanedString = cleanedString.replace(/\\"/g, '"');
    
    // --- End of String Cleaning ---

    // Attempt to parse the cleaned string into a JSON object.
    const serviceAccount = JSON.parse(cleanedString);

    // Initialize the app or get the existing one.
    if (getApps().length) {
      adminApp = getApps()[0];
    } else {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    }

    // Return the services.
    return {
      auth: getAuth(adminApp),
      db: getFirestore(adminApp),
    };
  } catch (e: any) {
    // --- CRITICAL: Log the string that failed ---
    console.error(
      '[FATAL] Firebase Admin Init Failed. The JSON string is malformed.'
    );
    console.error(
      '[FATAL] Raw string (first 50 chars):',
      serviceAccountString.substring(0, 50)
    );
    console.error(
      '[FATAL] Cleaned string (first 50 chars):',
      cleanedString.substring(0, 50)
    );
    console.error('Failed to parse Firebase Admin SDK service account:', e.message);
    
    // Re-throw the error so the application fails fast.
    throw new Error('Could not initialize Firebase Admin SDK. ' + e.message);
  }
}
