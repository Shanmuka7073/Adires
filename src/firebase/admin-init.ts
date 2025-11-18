
'use server';

// This file is temporarily disabled as all Firebase Admin SDK functionality has been removed
// for client-side development focus. It can be restored when server-side features are needed.

export async function getAdminServices(): Promise<any> {
    console.warn("Firebase Admin services are not available in this client-focused build.");
    return {
        app: null,
        auth: null,
        db: null,
    };
}
