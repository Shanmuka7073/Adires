'use server';
/**
 * @fileOverview A library for creating and verifying voiceprints for user authentication without external AI.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { getAdminServices } from '@/firebase/admin-init';
import type { Voiceprint } from '@/lib/types';
import { z } from 'zod';

// --- SCHEMA DEFINITIONS ---

export const CreateVoiceprintInputSchema = z.object({
  userId: z.string().describe('The unique ID of the user.'),
  audioDataUri: z
    .string()
    .describe(
      "A recording of the user's voice as a data URI. Must include a MIME type and use Base64 encoding. E.g., 'data:audio/webm;base64,...'"
    ),
});
export type CreateVoiceprintInput = z.infer<typeof CreateVoiceprintInputSchema>;

export const CreateVoiceprintOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the voiceprint was successfully saved.'),
  enrollmentCount: z.number().describe('The total number of enrollments the user now has.'),
  error: z.string().optional().describe('An error message if the process failed.'),
});
export type CreateVoiceprintOutput = z.infer<typeof CreateVoiceprintOutputSchema>;

export const VerifyVoiceprintInputSchema = z.object({
  userId: z.string().describe('The unique ID of the user to verify against.'),
  audioDataUri: z.string().describe("A new voice recording to compare against the stored voiceprint."),
});
export type VerifyVoiceprintInput = z.infer<typeof VerifyVoiceprintInputSchema>;

export const VerifyVoiceprintOutputSchema = z.object({
    isMatch: z.boolean().describe('Whether the new recording matches the stored voiceprint.'),
    confidence: z.number().describe('A score from 0 to 1 indicating the similarity.'),
    error: z.string().optional().describe('An error message if verification failed.'),
});
export type VerifyVoiceprintOutput = z.infer<typeof VerifyVoiceprintOutputSchema>;


// --- CORE FUNCTIONS ---

/**
 * Extracts a simple feature vector from an audio data URI.
 * This is a basic simulation and NOT a secure biometric analysis.
 * @param audioDataUri The base64 encoded audio data.
 * @returns A promise that resolves to an array of numbers representing the voice features.
 */
async function analyzeVoiceAndExtractFeatures(audioDataUri: string): Promise<number[]> {
  // In this placeholder, we're generating a "feature vector" based on the length
  // and some simple characteristics of the base64 string.
  const base64 = audioDataUri.split(',')[1];
  if (!base64) {
      throw new Error("Invalid audio data URI: Missing base64 content.");
  }

  const features = [
    base64.length,
    base64.substring(0, 50).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0),
    base64.substring(base64.length - 50).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ];

  // Add some "randomness" to simulate real-world variability
  for (let i = 0; i < 5; i++) {
    features.push(Math.sin(base64.length * i) * 1000);
  }

  return features;
}

/**
 * Creates or updates a user's voiceprint from an audio sample.
 * This is done by averaging feature vectors from multiple enrollments.
 */
export async function createVoiceprint(input: CreateVoiceprintInput): Promise<CreateVoiceprintOutput> {
    try {
        const { db } = await getAdminServices();
        const voiceprintRef = db.collection('voiceprints').doc(input.userId);

        const newEnrollmentFeatures = await analyzeVoiceAndExtractFeatures(input.audioDataUri);

        const doc = await voiceprintRef.get();
        let existingEnrollments: number[][] = [];

        if (doc.exists) {
            existingEnrollments = (doc.data() as Voiceprint).enrollments || [];
        }

        existingEnrollments.push(newEnrollmentFeatures);
        
        const featureCount = existingEnrollments[0].length;
        const finalVoiceprint = new Array(featureCount).fill(0);
        for (const enrollment of existingEnrollments) {
            for (let i = 0; i < featureCount; i++) {
                finalVoiceprint[i] += enrollment[i] || 0;
            }
        }
        for (let i = 0; i < featureCount; i++) {
            finalVoiceprint[i] /= existingEnrollments.length;
        }

        const dataToSave: Partial<Voiceprint> = {
            userId: input.userId,
            enrollments: existingEnrollments,
            voiceprint: finalVoiceprint,
            lastUpdatedAt: new Date().toISOString(),
        };

        if (!doc.exists) {
            dataToSave.createdAt = new Date().toISOString();
        }

        await voiceprintRef.set(dataToSave, { merge: true });

        return {
            isSuccess: true,
            enrollmentCount: existingEnrollments.length,
        };

    } catch (error: any) {
        console.error("Error in createVoiceprint:", error);
        return {
            isSuccess: false,
            enrollmentCount: 0,
            error: error.message || "An unknown error occurred.",
        };
    }
}


/**
 * Verifies a new audio sample against a user's stored voiceprint.
 */
export async function verifyVoiceprint(input: VerifyVoiceprintInput): Promise<VerifyVoiceprintOutput> {
    const SIMILARITY_THRESHOLD = 0.95; // 95% similarity required for a match

    try {
        const { db } = await getAdminServices();
        const voiceprintRef = doc(db, 'voiceprints', input.userId);

        const docSnap = await getDoc(voiceprintRef);
        if (!docSnap.exists()) {
            return { isMatch: false, confidence: 0, error: 'User has not enrolled a voiceprint.' };
        }

        const storedVoiceprint = (docSnap.data() as Voiceprint).voiceprint;
        if (!storedVoiceprint || storedVoiceprint.length === 0) {
             return { isMatch: false, confidence: 0, error: 'Stored voiceprint is invalid or empty.' };
        }

        const newFeatures = await analyzeVoiceAndExtractFeatures(input.audioDataUri);

        // Calculate cosine similarity between the two feature vectors
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;
        for (let i = 0; i < storedVoiceprint.length; i++) {
            dotProduct += storedVoiceprint[i] * (newFeatures[i] || 0);
            magnitudeA += storedVoiceprint[i] * storedVoiceprint[i];
            magnitudeB += (newFeatures[i] || 0) * (newFeatures[i] || 0);
        }
        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return { isMatch: false, confidence: 0, error: 'Cannot compare with a zero-magnitude vector.' };
        }

        const confidence = dotProduct / (magnitudeA * magnitudeB);
        
        return {
            isMatch: confidence >= SIMILARITY_THRESHOLD,
            confidence: confidence,
        };

    } catch (error: any) {
        console.error("Error in verifyVoiceprint:", error);
        return {
            isMatch: false,
            confidence: 0,
            error: error.message || 'An unknown error occurred during verification.',
        };
    }
}