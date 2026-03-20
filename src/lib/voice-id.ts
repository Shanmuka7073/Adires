'use server';
/**
 * @fileOverview Voice biometric service (STUBBED).
 * All logic has been removed to simplify the build and focus on marketplace features.
 */

import type { CreateVoiceprintInput, CreateVoiceprintOutput, VerifyVoiceprintInput, VerifyVoiceprintOutput } from '@/lib/types';

export async function createVoiceprint(input: CreateVoiceprintInput): Promise<CreateVoiceprintOutput> {
    return {
        isSuccess: false,
        enrollmentCount: 0,
        error: "Voice ID features have been decommissioned."
    };
}

export async function verifyVoiceprint(input: VerifyVoiceprintInput): Promise<VerifyVoiceprintOutput> {
    return {
        isMatch: false,
        confidence: 0,
        error: "Voice ID features have been decommissioned."
    };
}
