
'use server';
/**
 * @fileOverview An AI flow for creating and managing voiceprints for user authentication.
 *
 * - createVoiceprint - Creates or updates a user's voiceprint from an audio sample.
 * - CreateVoiceprintInput - The input type for the createVoiceprint function.
 * - CreateVoiceprintOutput - The return type for the createVoiceprint function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminServices } from '@/firebase/admin-init';
import type { Voiceprint } from '@/lib/types';

const CreateVoiceprintInputSchema = z.object({
  userId: z.string().describe('The unique ID of the user.'),
  audioDataUri: z
    .string()
    .describe(
      "A recording of the user's voice as a data URI. Must include a MIME type and use Base64 encoding. E.g., 'data:audio/webm;base64,...'"
    ),
});
export type CreateVoiceprintInput = z.infer<typeof CreateVoiceprintInputSchema>;

const CreateVoiceprintOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the voiceprint was successfully saved.'),
  enrollmentCount: z.number().describe('The total number of enrollments the user now has.'),
  error: z.string().optional().describe('An error message if the process failed.'),
});
export type CreateVoiceprintOutput = z.infer<typeof CreateVoiceprintOutputSchema>;


// This is a placeholder function simulating a complex voice analysis process.
// In a real application, this would involve a sophisticated third-party service
// or a complex machine learning model to extract unique features from the voice.
async function analyzeVoiceAndExtractFeatures(audioDataUri: string): Promise<number[]> {
  // Simulate network delay and processing time.
  await new Promise(resolve => setTimeout(resolve, 1500));

  // In this placeholder, we're generating a "feature vector" based on the length
  // and some simple characteristics of the base64 string. This is NOT a real
  // voiceprint but serves to simulate the process of getting a unique numerical array.
  const base64 = audioDataUri.split(',')[1];
  const features = [
    base64.length, // Feature 1: Length of the audio data
    base64.substring(0, 50).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0), // Feature 2: Sum of first 50 char codes
    base64.substring(base64.length - 50).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) // Feature 3: Sum of last 50 char codes
  ];

  // Add some randomness to simulate real-world variability
  for (let i = 0; i < 5; i++) {
    features.push(Math.random() * 1000);
  }

  return features;
}


export async function createVoiceprint(input: CreateVoiceprintInput): Promise<CreateVoiceprintOutput> {
    try {
        const { db } = await getAdminServices();
        const voiceprintRef = db.collection('voiceprints').doc(input.userId);

        // 1. Simulate extracting features from the provided audio.
        const newEnrollmentFeatures = await analyzeVoiceAndExtractFeatures(input.audioDataUri);

        const doc = await voiceprintRef.get();
        let existingEnrollments: number[][] = [];

        if (doc.exists) {
            existingEnrollments = (doc.data() as Voiceprint).enrollments || [];
        }

        // 2. Add the new enrollment to the list.
        existingEnrollments.push(newEnrollmentFeatures);
        
        // 3. Average the feature vectors to create the final voiceprint
        const featureCount = existingEnrollments[0].length;
        const finalVoiceprint = new Array(featureCount).fill(0);
        for (const enrollment of existingEnrollments) {
            for (let i = 0; i < featureCount; i++) {
                finalVoiceprint[i] += enrollment[i];
            }
        }
        for (let i = 0; i < featureCount; i++) {
            finalVoiceprint[i] /= existingEnrollments.length;
        }

        // 4. Save the updated data to Firestore.
        const dataToSave: Partial<Voiceprint> = {
            userId: input.userId,
            enrollments: existingEnrollments,
            voiceprint: finalVoiceprint, // The averaged voiceprint
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
        console.error("Error in createVoiceprint flow:", error);
        return {
            isSuccess: false,
            enrollmentCount: 0,
            error: error.message || "An unknown error occurred.",
        };
    }
}
