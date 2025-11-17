'use server';

// Server-side actions are temporarily disabled.
// This file is kept as a placeholder for when server functionality is re-enabled.

export async function getSystemStatus() {
    // Return a default "offline" status for all server components
    return {
        status: 'ok', // The action itself is ok, but services are offline
        llmStatus: 'Offline',
        serverDbStatus: 'Offline',
        errorMessage: "Server-side features are disabled during development.",
        counts: { users: 0, stores: 0, deliveryPartners: 0, voiceCommands: 0 },
    };
}

export async function logLoginAttempt(email: string, status: 'success' | 'failure', userId?: string, errorMessage?: string) {
    // This server action is disabled. It can be re-enabled with Firebase Admin SDK.
    console.log(`Login Attempt [DISABLED]: ${email}, Status: ${status}`);
    return;
}
