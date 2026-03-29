'use server';
/**
 * @fileOverview Voice biometric service (STUBBED).
 * All logic has been removed to simplify the build and focus on marketplace features.
 */
// ❌ remove type import completely

export async function createVoiceprint(input: any): Promise<any> {
    return {
        isSuccess: false,
        enrollmentCount: 0,
        error: "Voice ID features have been decommissioned."
    };
}

export async function verifyVoiceprint(input: any): Promise<any> {
    return {
        isMatch: false,
        confidence: 0,
        error: "Voice ID features have been decommissioned."
    };
}
